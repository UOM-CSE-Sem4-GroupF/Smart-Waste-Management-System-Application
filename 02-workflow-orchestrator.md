# Technical Specification — Collection Workflow Orchestrator
**Owner:** F3  
**Repo:** group-f-application/workflow-orchestrator  
**Version:** 1.0  
**Stack:** Node.js 20 · TypeScript · Fastify · Prisma · KafkaJS

---

## 1. Purpose

The collection workflow orchestrator is the brain of the emergency collection process. It detects urgent bins via Kafka, decides when and what to collect, assembles the set of clusters for a job, hands dispatch to the scheduler, and manages the complete job lifecycle through a persistent state machine.

It is the only service that coordinates other services through direct calls (orchestration pattern). Everything else in the system is choreography.

---

## 2. Context in the system

```
waste.bin.processed ──► Orchestrator ──► POST /internal/scheduler/dispatch
waste.routine.schedule.trigger ──►    │──► POST /internal/notify/job-created
waste.model.retrained ──►             │──► POST /internal/bins/:id/mark-collected
                                      │──► Hyperledger (via Kong)
                                      │──► Publishes waste.job.completed
                                      └──► Publishes waste.audit.events
```

---

## 3. Responsibilities

- Consume `waste.bin.processed` — detect urgent bins and trigger emergency jobs
- Consume `waste.routine.schedule.trigger` — create routine jobs on schedule
- Manage wait window logic for non-critical urgent bins
- Assemble cluster sets for each job
- Call scheduler to dispatch vehicles
- Manage the complete job state machine
- Notify dashboard when jobs are created or state changes
- Record completed jobs on Hyperledger blockchain
- Publish `waste.job.completed` for downstream consumers

---

## 4. Folder structure

```
workflow-orchestrator/
├── src/
│   ├── consumers/
│   │   ├── binProcessedConsumer.ts
│   │   ├── routineScheduleConsumer.ts
│   │   └── modelRetrainedConsumer.ts
│   ├── core/
│   │   ├── orchestrator.ts          ← main workflow execution
│   │   ├── stateMachine.ts          ← state transition definitions
│   │   ├── stepExecutor.ts          ← service call wrapper with retry
│   │   └── waitWindowManager.ts     ← wait + cluster scan logic
│   ├── clients/
│   │   ├── binStatusClient.ts       ← calls bin-status-service
│   │   ├── schedulerClient.ts       ← calls scheduler-service
│   │   ├── notificationClient.ts    ← calls notification-service
│   │   └── hyperledgerClient.ts     ← calls Hyperledger via Kong
│   ├── api/
│   │   ├── jobRoutes.ts
│   │   └── healthRoutes.ts
│   ├── db/
│   │   └── queries.ts
│   └── index.ts
├── prisma/schema.prisma
├── Dockerfile
└── package.json
```

---

## 5. State machine

Every job — routine or emergency — goes through this state machine. Every transition is recorded in `f3.job_state_transitions`.

```
CREATED
  │
  ├── emergency jobs only
  ▼
BIN_CONFIRMING ── (bin no longer urgent) ──► CANCELLED
  │
  ▼
BIN_CONFIRMED
  │
  ├── emergency: wait window logic (may expand to more clusters)
  ▼
CLUSTER_ASSEMBLING ── (wait expired or second cluster found)
  │
  ▼
CLUSTER_ASSEMBLED
  │
  ▼
DISPATCHING ── (scheduler call fails all retries) ──► ESCALATED
  │
  ▼
DISPATCHED
  │
  ▼
DRIVER_NOTIFIED
  │
  ▼
IN_PROGRESS ── (vehicle weight limit reached mid-job) ──► SPLIT_JOB
  │
  ▼
COMPLETING
  │
  ▼
COLLECTION_DONE
  │
  ▼
RECORDING_AUDIT ── (Hyperledger fails 3 retries) ──► AUDIT_FAILED
  │
  ▼
AUDIT_RECORDED
  │
  ▼
COMPLETED ◄── terminal success

Failure terminals:
  FAILED      ── unrecoverable system error
  ESCALATED   ── needs supervisor (scheduler could not dispatch)
  CANCELLED   ── supervisor manually cancelled or bin no longer urgent
```

### State transition rules

```typescript
// stateMachine.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:             ['BIN_CONFIRMING', 'CLUSTER_ASSEMBLING'],
  // routine jobs skip BIN_CONFIRMING and go straight to CLUSTER_ASSEMBLING
  BIN_CONFIRMING:      ['BIN_CONFIRMED', 'CANCELLED'],
  BIN_CONFIRMED:       ['CLUSTER_ASSEMBLING'],
  CLUSTER_ASSEMBLING:  ['CLUSTER_ASSEMBLED'],
  CLUSTER_ASSEMBLED:   ['DISPATCHING'],
  DISPATCHING:         ['DISPATCHED', 'ESCALATED', 'FAILED'],
  DISPATCHED:          ['DRIVER_NOTIFIED'],
  DRIVER_NOTIFIED:     ['IN_PROGRESS'],
  IN_PROGRESS:         ['COMPLETING', 'SPLIT_JOB', 'CANCELLED'],
  COMPLETING:          ['COLLECTION_DONE'],
  COLLECTION_DONE:     ['RECORDING_AUDIT'],
  RECORDING_AUDIT:     ['AUDIT_RECORDED', 'AUDIT_FAILED'],
  AUDIT_RECORDED:      ['COMPLETED'],
  AUDIT_FAILED:        ['COMPLETED'],
  // audit failure does not block completion — log and continue
}

function validateTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`)
  }
}
```

---

## 6. Kafka consumers

### 6.1 Bin processed consumer (emergency job trigger)

**Topic:** `waste.bin.processed`  
**Group ID:** `workflow-orchestrator-emergency`

**Processing logic:**

```
Step 1 — Filter
  Only process if urgency_score >= 80
  Skip all other messages

Step 2 — Check for existing active job
  Query f3.collection_jobs WHERE:
    trigger_bin_id = bin_id
    OR cluster_id of this bin is in any active job's clusters
    AND state NOT IN ('COMPLETED','CANCELLED','FAILED')
  If active job exists → skip this message

Step 3 — Deduplicate
  Check in-memory set of recently processed bin_ids
  If this bin_id was processed in last 5 minutes → skip

Step 4 — Create job record
  INSERT INTO f3.collection_jobs:
    job_type = 'emergency'
    zone_id = bin's zone_id
    state = 'CREATED'
    trigger_bin_id = bin_id
    trigger_urgency_score = urgency_score
    trigger_waste_category = waste_category
    kafka_offset = message offset

Step 5 — Start workflow asynchronously
  orchestrator.executeEmergencyWorkflow(jobId, binEvent)
  Do NOT await — fire and forget
  Catch unhandled errors and mark job as FAILED
```

---

### 6.2 Routine schedule consumer

**Topic:** `waste.routine.schedule.trigger`  
**Group ID:** `workflow-orchestrator-routine`

```typescript
interface RoutineScheduleTrigger {
  version: string
  source_service: 'airflow'
  timestamp: string
  payload: {
    schedule_id: string
    zone_id: number
    zone_name: string
    waste_category_id: number | null  // null = all categories
    scheduled_date: string
    scheduled_time: string
    bin_ids: string[]       // all active bins in zone
    route_plan_id: string   // pre-computed route from OR-Tools
  }
}
```

**Processing logic:**

```
Step 1 — Create routine job
  INSERT INTO f3.collection_jobs:
    job_type = 'routine'
    zone_id
    state = 'CREATED'
    schedule_id
    scheduled_date
    scheduled_time
    route_plan_id (pre-computed by Airflow + OR-Tools)

Step 2 — Start workflow from CLUSTER_ASSEMBLED
  (routine jobs skip BIN_CONFIRMING and wait window)
  orchestrator.executeRoutineWorkflow(jobId, trigger)
```

---

## 7. Emergency workflow execution

```typescript
// core/orchestrator.ts

async function executeEmergencyWorkflow(
  jobId: string,
  binEvent: BinProcessedEvent
): Promise<void> {

  try {

    // ── STEP 1: Confirm bin urgency ──────────────────────────
    await updateState(jobId, 'BIN_CONFIRMING')

    const snapshot = await step(jobId, 'bin_confirmation', () =>
      binStatusClient.getClusterSnapshot(binEvent.cluster_id)
    )

    if (!snapshot.bins.some(b => b.urgency_score >= 80)) {
      await updateState(jobId, 'CANCELLED', 'Bin no longer urgent at confirmation')
      return
    }

    await updateState(jobId, 'BIN_CONFIRMED')


    // ── STEP 2: Wait window + cluster scan ───────────────────
    await updateState(jobId, 'CLUSTER_ASSEMBLING')

    const clusterSet = await waitWindowManager.assemble({
      jobId,
      triggerBinEvent: binEvent,
      initialSnapshot: snapshot
    })

    await db.updateJob(jobId, {
      clusters: clusterSet.cluster_ids,
      bins_to_collect: clusterSet.bin_ids,
      planned_weight_kg: clusterSet.total_weight_kg
    })

    await updateState(jobId, 'CLUSTER_ASSEMBLED')


    // ── STEP 3: Dispatch ─────────────────────────────────────
    await updateState(jobId, 'DISPATCHING')

    const dispatch = await step(jobId, 'dispatch', () =>
      schedulerClient.dispatch({
        job_id: jobId,
        clusters: clusterSet.cluster_ids,
        bins_to_collect: clusterSet.bin_ids,
        total_estimated_weight_kg: clusterSet.total_weight_kg,
        waste_category: binEvent.waste_category,
        zone_id: binEvent.zone_id,
        priority: derivePriority(binEvent.urgency_score)
      })
    , { retries: 3, retryDelayMs: 120_000 })

    if (!dispatch.success) {
      await updateState(jobId, 'ESCALATED', 'No vehicle available after 3 attempts')
      await notificationClient.notifyDashboard({
        event_type: 'job:escalated',
        job_id: jobId,
        zone_id: binEvent.zone_id,
        reason: 'No available vehicle'
      })
      return
    }

    await db.updateJob(jobId, {
      assigned_vehicle_id: dispatch.vehicle_id,
      assigned_driver_id: dispatch.driver_id,
      route_plan_id: dispatch.route_plan_id,
      assigned_at: new Date()
    })

    await updateState(jobId, 'DISPATCHED')


    // ── STEP 4: Notify driver (done inside scheduler) ────────
    // Scheduler calls notification service for driver push
    // Orchestrator notifies dashboard

    await updateState(jobId, 'DRIVER_NOTIFIED')

    await notificationClient.notifyDashboard({
      event_type: 'job:created',
      job_id: jobId,
      job_type: 'emergency',
      zone_id: binEvent.zone_id,
      clusters: clusterSet.cluster_ids,
      vehicle_id: dispatch.vehicle_id,
      driver_id: dispatch.driver_id,
      route: dispatch.route,
      total_bins: clusterSet.bin_ids.length,
      planned_weight_kg: clusterSet.total_weight_kg
    })


    // ── STEP 5: Job now IN_PROGRESS ──────────────────────────
    // Scheduler tracks execution via waste.vehicle.location
    // Orchestrator waits for scheduler to call back: job complete

    await updateState(jobId, 'IN_PROGRESS')

    // Workflow pauses here until scheduler reports completion
    // Handled by POST /internal/jobs/:id/complete

  } catch (error) {
    await handleWorkflowFailure(jobId, error)
  }
}
```

---

## 8. Wait window manager

```typescript
// core/waitWindowManager.ts

interface AssembleResult {
  cluster_ids: string[]
  bin_ids: string[]
  total_weight_kg: number
}

async function assemble(params: {
  jobId: string
  triggerBinEvent: BinProcessedEvent
  initialSnapshot: ClusterSnapshot
}): Promise<AssembleResult> {

  const { triggerBinEvent, initialSnapshot } = params

  // Start with triggering cluster's collectible bins
  const clusters: ClusterSnapshot[] = [initialSnapshot]

  // Determine if immediate dispatch or wait
  const isImmediate =
    triggerBinEvent.urgency_score >= 90 ||
    IMMEDIATE_CATEGORIES.includes(triggerBinEvent.waste_category)
    // IMMEDIATE_CATEGORIES: ['e_waste', 'hazardous']

  if (isImmediate) {
    return buildResult(clusters)
  }

  // Calculate wait window
  const predictedFullAt = initialSnapshot.bins
    .filter(b => b.should_collect)
    .map(b => new Date(b.predicted_full_at ?? '').getTime())
    .filter(t => !isNaN(t))

  const earliestFull = Math.min(...predictedFullAt)
  const safetyMarginMs = 45 * 60 * 1000
  const maxWaitMs = 30 * 60 * 1000
  const waitUntil = Math.min(
    earliestFull - safetyMarginMs,
    Date.now() + maxWaitMs
  )

  // Scan for nearby clusters approaching urgency
  const nearbyClusters = await binStatusClient.scanNearby({
    zone_id: triggerBinEvent.zone_id,
    urgency_threshold: 70,
    within_minutes: Math.round((waitUntil - Date.now()) / 60_000),
    exclude_cluster_ids: clusters.map(c => c.cluster_id)
  })

  if (nearbyClusters.clusters.length > 0) {
    // Nearby clusters found — add them and dispatch immediately
    for (const nearby of nearbyClusters.clusters) {
      const nearbySnapshot = await binStatusClient.getClusterSnapshot(
        nearby.cluster_id
      )
      clusters.push(nearbySnapshot)
    }
    return buildResult(clusters)
  }

  // No nearby clusters — wait until window expires
  const remainingWaitMs = waitUntil - Date.now()
  if (remainingWaitMs > 0) {
    await sleep(remainingWaitMs)

    // Re-scan after waiting
    const laterClusters = await binStatusClient.scanNearby({
      zone_id: triggerBinEvent.zone_id,
      urgency_threshold: 80,
      within_minutes: 15,
      exclude_cluster_ids: clusters.map(c => c.cluster_id)
    })

    for (const later of laterClusters.clusters) {
      const snap = await binStatusClient.getClusterSnapshot(later.cluster_id)
      clusters.push(snap)
    }
  }

  return buildResult(clusters)
}

function buildResult(clusters: ClusterSnapshot[]): AssembleResult {
  const allBins = clusters.flatMap(c =>
    c.bins.filter(b => b.should_collect).map(b => b.bin_id)
  )
  const totalWeight = clusters.reduce(
    (sum, c) => sum + c.collectible_bins_weight_kg, 0
  )
  return {
    cluster_ids: clusters.map(c => c.cluster_id),
    bin_ids: allBins,
    total_weight_kg: parseFloat(totalWeight.toFixed(2))
  }
}

const IMMEDIATE_CATEGORIES = ['e_waste']
```

---

## 9. Job completion handler

Called by scheduler when all bins are collected.

### POST /internal/jobs/:job_id/complete

```typescript
interface JobCompleteRequest {
  job_id: string
  vehicle_id: string
  driver_id: string
  bins_collected: Array<{
    bin_id: string
    collected_at: string
    fill_level_at_collection: number
    actual_weight_kg?: number
    gps_lat: number
    gps_lng: number
  }>
  bins_skipped: Array<{
    bin_id: string
    skip_reason: string
  }>
  actual_weight_kg: number
  actual_distance_km: number
  route_gps_trail: Array<{ lat: number, lng: number, timestamp: string }>
}
```

**Processing:**

```
Step 1 — Mark each collected bin via bin-status-service
  For each bin in bins_collected:
    POST /internal/bins/:bin_id/mark-collected
    (updates fill to 0, publishes dashboard update)

Step 2 — Calculate metrics
  actual_duration_min = now - job.started_at
  planned vs actual distance comparison
  UPDATE collection_jobs SET
    actual_weight_kg, actual_distance_km, actual_duration_min,
    collection_done_at = NOW()
  → state: COLLECTION_DONE

Step 3 — Record on Hyperledger
  → state: RECORDING_AUDIT
  POST {kong}/api/v1/blockchain/collections
  Body: {
    job_id, job_type, zone_id, driver_id, vehicle_id,
    bins_collected (with weights, GPS, timestamps),
    total_weight_kg, route_distance_km,
    started_at, completed_at,
    gps_trail_hash: sha256(route_gps_trail)
  }
  Timeout: 30 seconds
  Retries: 3 with exponential backoff
  If all fail → state: AUDIT_FAILED (log, continue to COMPLETED)
  If success → store hyperledger_tx_id
  → state: AUDIT_RECORDED

Step 4 — Complete job
  UPDATE collection_jobs SET
    completed_at = NOW()
  → state: COMPLETED

Step 5 — Publish to Kafka
  waste.job.completed:
  {
    job_id, job_type, zone_id,
    vehicle_id, driver_id,
    bins_collected_count, bins_skipped_count,
    actual_weight_kg, actual_distance_km,
    duration_minutes, hyperledger_tx_id,
    completed_at
  }

Step 6 — Notify dashboard
  POST /internal/notify/job-completed
  Dashboard moves job card from active → completed panel
```

---

## 10. Step executor

Every external service call goes through this helper.

```typescript
// core/stepExecutor.ts

async function step<T>(
  jobId: string,
  stepName: string,
  serviceCall: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {}
): Promise<T> {

  const retries = options.retries ?? 1
  const retryDelayMs = options.retryDelayMs ?? 5_000
  const startTime = Date.now()

  for (let attempt = 1; attempt <= retries; attempt++) {

    try {
      const result = await serviceCall()
      const duration = Date.now() - startTime

      // Log successful step
      await db.insertStepResult({
        job_id: jobId,
        step_name: stepName,
        attempt_number: attempt,
        success: true,
        duration_ms: duration
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime

      await db.insertStepResult({
        job_id: jobId,
        step_name: stepName,
        attempt_number: attempt,
        success: false,
        error_message: error.message,
        duration_ms: duration
      })

      if (attempt < retries) {
        // Exponential backoff: 2s, 4s, 8s...
        const backoff = retryDelayMs * Math.pow(2, attempt - 1)
        await sleep(backoff)
        continue
      }

      throw error
    }
  }
}
```

---

## 11. State update helper

Every state change must be persisted before the next action.

```typescript
// This prevents inconsistency if orchestrator crashes mid-workflow
// On restart, read state from DB and resume from correct point

async function updateState(
  jobId: string,
  toState: string,
  reason?: string,
  actor = 'system'
): Promise<void> {

  const job = await db.getJob(jobId)
  validateTransition(job.state, toState)

  // Write state BEFORE doing anything else
  await db.updateJobState(jobId, toState)

  await db.insertStateTransition({
    job_id: jobId,
    from_state: job.state,
    to_state: toState,
    reason,
    actor
  })
}
```

---

## 12. Public API (via Kong)

### GET /api/v1/collection-jobs

**Query parameters:**
```
job_type     routine | emergency
state        CREATED | IN_PROGRESS | COMPLETED | ESCALATED | etc
zone_id      integer
date_from    ISO 8601
date_to      ISO 8601
page         integer (default 1)
limit        integer (default 20, max 100)
```

**Response:**
```typescript
{
  data: Array<{
    id: string
    job_type: string
    zone_id: number
    zone_name: string
    state: string
    priority: number
    assigned_vehicle_id: string | null
    assigned_driver_id: string | null
    clusters: string[]
    planned_weight_kg: number | null
    actual_weight_kg: number | null
    bins_total: number
    bins_collected: number
    bins_skipped: number
    created_at: string
    completed_at: string | null
    duration_minutes: number | null
  }>
  total: number
  page: number
  limit: number
}
```

**Auth:** supervisor, fleet-operator

---

### GET /api/v1/collection-jobs/:job_id

Full job detail including state machine history.

**Response:**
```typescript
{
  // all list fields plus:
  trigger_bin_id: string | null
  trigger_urgency_score: number | null
  route_plan_id: string | null
  planned_distance_km: number | null
  actual_distance_km: number | null
  planned_duration_min: number | null
  hyperledger_tx_id: string | null
  failure_reason: string | null
  escalated_at: string | null
  bin_collections: Array<{
    bin_id: string
    cluster_id: string
    sequence_number: number
    status: 'collected' | 'skipped' | 'pending'
    collected_at: string | null
    fill_level_at_collection: number | null
    estimated_weight_kg: number
    actual_weight_kg: number | null
    skip_reason: string | null
  }>
  state_history: Array<{
    from_state: string | null
    to_state: string
    reason: string | null
    actor: string
    transitioned_at: string
  }>
  step_log: Array<{
    step_name: string
    attempt_number: number
    success: boolean
    duration_ms: number
    executed_at: string
  }>
}
```

**Auth:** supervisor, fleet-operator, driver (own jobs only)

---

### POST /api/v1/collection-jobs/:job_id/cancel

Supervisor manually cancels a job.

**Request body:**
```typescript
{ reason: string }
```

**Processing:**
```
Only allowed in states: CREATED, BIN_CONFIRMING, BIN_CONFIRMED,
CLUSTER_ASSEMBLING, CLUSTER_ASSEMBLED, DISPATCHING, DISPATCHED, DRIVER_NOTIFIED

If IN_PROGRESS → reject (driver already collecting)

On cancel:
  Release vehicle in scheduler service
  Notify driver via notification service
  Update state to CANCELLED
```

**Auth:** supervisor only

---

### GET /api/v1/collection-jobs/stats

**Query parameters:** `date_from`, `date_to`, `zone_id`

**Response:**
```typescript
{
  total_jobs: number
  emergency_jobs: number
  routine_jobs: number
  completed_jobs: number
  escalated_jobs: number
  cancelled_jobs: number
  completion_rate_pct: number
  avg_duration_minutes: number
  avg_bins_per_job: number
  avg_weight_per_job_kg: number
  emergency_vs_routine_ratio: number
}
```

**Auth:** supervisor

---

## 13. Acceptance criteria

```
[ ] Consumer: detects urgent bins (score >= 80) from waste.bin.processed
[ ] Consumer: skips bins that already have active jobs
[ ] Consumer: creates emergency job records in DB
[ ] Wait window: calculates correct max_wait from predicted_full_at
[ ] Wait window: dispatches immediately for urgency >= 90 or e_waste
[ ] Wait window: scans nearby clusters and adds them to job
[ ] Wait window: dispatches after max_wait if no nearby clusters found
[ ] Dispatch: calls scheduler with correct cluster + weight payload
[ ] Dispatch: retries 3 times on scheduler failure
[ ] Dispatch: escalates to supervisor after 3 failed attempts
[ ] Dispatch: updates job with vehicle and driver assignment
[ ] Notification: notifies dashboard with job:created event after dispatch
[ ] Completion: marks each bin collected via bin-status-service
[ ] Completion: records job on Hyperledger
[ ] Completion: publishes waste.job.completed to Kafka
[ ] Completion: handles Hyperledger failure gracefully (AUDIT_FAILED)
[ ] State machine: every transition recorded in job_state_transitions
[ ] State machine: invalid transitions throw error
[ ] API: GET /api/v1/collection-jobs returns correct paginated results
[ ] API: GET /api/v1/collection-jobs/:id returns full state history
[ ] API: POST /cancel rejects IN_PROGRESS jobs
[ ] Error: pod crash mid-workflow — on restart reads state from DB and resumes
```
