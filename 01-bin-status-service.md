# Technical Specification — Bin Status Service
**Owner:** F3  
**Repo:** group-f-application/bin-status-service  
**Version:** 1.0  
**Stack:** Node.js 20 · TypeScript · Fastify · Prisma · KafkaJS · InfluxDB client

---

## 1. Purpose

The bin status service is the domain authority for everything related to bin and cluster state. It translates raw sensor intelligence (produced by Flink) into business-meaningful state, decides what the dashboard needs to know, and enriches that data before forwarding it for live delivery.

It sits at the boundary between the data layer (F2) and the interaction layer (F3 dashboard/notification).

---

## 2. Context in the system

```
waste.bin.processed (Flink) ──► Bin status service ──► waste.bin.dashboard.updates
waste.zone.statistics (Flink) ──►                  │
                                                   │──► Orchestrator (responds to /internal calls)
                                                   │──► Dashboard REST APIs (via Kong)
```

---

## 3. Responsibilities

- Consume `waste.bin.processed` and apply business rules
- Consume `waste.zone.statistics` and decide whether to forward to dashboard
- Provide cluster snapshot API for the orchestrator
- Mark bins as collected when orchestrator reports completion
- Expose bin and cluster query APIs for the dashboard
- Enrich all data before publishing to `waste.bin.dashboard.updates`
- Apply smart filtering — decide what is worth pushing to the dashboard

---

## 4. Tech stack and project setup

```
Runtime:         Node.js 20
Language:        TypeScript (strict mode)
HTTP framework:  Fastify
ORM:             Prisma (PostgreSQL — f2 schema read, f3 schema write)
Kafka client:    KafkaJS
InfluxDB client: @influxdata/influxdb-client
Validation:      Zod
Logging:         pino (structured JSON)
Testing:         Jest + Supertest
```

### 4.1 Environment variables (injected by Vault)

```
DB_HOST              PostgreSQL host
DB_PORT              PostgreSQL port
DB_NAME              waste_db
DB_USER              bin_status_user
DB_PASSWORD          (from Vault)
KAFKA_BROKERS        kafka.messaging.svc.cluster.local:9092
INFLUXDB_URL         http://influxdb.messaging.svc.cluster.local:8086
INFLUXDB_TOKEN       (from Vault)
INFLUXDB_ORG         waste-mgmt
INFLUXDB_BUCKET      bin-telemetry
SERVICE_PORT         3000
```

### 4.2 Folder structure

```
bin-status-service/
├── src/
│   ├── consumers/
│   │   ├── binProcessedConsumer.ts
│   │   └── zoneStatisticsConsumer.ts
│   ├── rules/
│   │   ├── urgencyClassifier.ts
│   │   ├── collectionTrigger.ts
│   │   ├── dashboardFilter.ts
│   │   └── weightCalculator.ts
│   ├── enrichment/
│   │   ├── binEnricher.ts
│   │   └── zoneEnricher.ts
│   ├── publishers/
│   │   └── dashboardPublisher.ts
│   ├── queries/
│   │   ├── binQueries.ts
│   │   ├── clusterQueries.ts
│   │   ├── historyQueries.ts
│   │   └── zoneQueries.ts
│   ├── cache/
│   │   └── zoneCache.ts
│   ├── api/
│   │   ├── internalRoutes.ts
│   │   └── publicRoutes.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 5. Kafka consumers

### 5.1 Bin processed consumer

**Topic:** `waste.bin.processed`  
**Group ID:** `bin-status-service`

```typescript
// consumers/binProcessedConsumer.ts

interface BinProcessedEvent {
  version: string
  source_service: string
  timestamp: string
  payload: {
    bin_id: string
    fill_level_pct: number
    urgency_score: number
    status: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline'
    estimated_weight_kg: number
    fill_rate_pct_per_hour: number
    predicted_full_at: string | null
    battery_level_pct: number
  }
}
```

**Processing logic per message:**

```
Step 1 — Load bin metadata
  Query f2.bins JOIN f2.waste_categories JOIN f2.bin_clusters
  to get: cluster_id, zone_id, volume_litres, waste_category,
          avg_kg_per_litre, cluster name and address

Step 2 — Recalculate weight
  estimated_weight_kg = (fill_level_pct / 100)
                        × volume_litres
                        × avg_kg_per_litre
  (always recalculate — never trust the value from Flink)

Step 3 — Check collection trigger
  IF urgency_score >= 80
  AND no active collection job exists for this bin's cluster
    → set collection_triggered = true
    → note: orchestrator decides whether to act
      (bin service just flags it)

Step 4 — Smart dashboard filter
  Should this update be pushed to dashboard?

  ALWAYS push:
    status changed from previous (normal→monitor, monitor→urgent, etc)
    urgency_score >= 80
    battery_level_pct < 10 (low battery alert)
    status = 'offline'

  THROTTLE (max 1 push per 60 seconds per bin):
    status unchanged AND status = 'normal'
    status unchanged AND status = 'monitor'

  SUPPRESS:
    fill_level_pct changed by < 1% AND status unchanged
    bin has active job already in progress

Step 5 — Enrich payload
  Add: cluster_id, cluster_name, zone_id, waste_category,
       waste_category_colour, collection_triggered,
       has_active_job (boolean — query f3.collection_jobs)

Step 6 — Publish to waste.bin.dashboard.updates
  event_type: 'bin:update'
  Include full enriched payload
```

**State tracking (in-memory per bin):**

```typescript
interface BinState {
  lastStatus: string
  lastUrgencyScore: number
  lastPushedAt: number  // timestamp ms
}

const binStateCache = new Map<string, BinState>()
```

---

### 5.2 Zone statistics consumer

**Topic:** `waste.zone.statistics`  
**Group ID:** `bin-status-service-zones`

```typescript
interface ZoneStatisticsEvent {
  version: string
  source_service: string
  timestamp: string
  payload: {
    zone_id: number
    avg_fill_level_pct: number
    urgent_bin_count: number
    critical_bin_count: number
    total_bins: number
    total_estimated_weight_kg: number
    dominant_waste_category: string
    category_breakdown: Record<string, {
      count: number
      avg_fill: number
      total_kg: number
    }>
    window_minutes: number
  }
}
```

**Processing logic per message:**

```
Step 1 — Check if meaningful change occurred
  Compare with cached previous zone stats
  SUPPRESS if:
    avg_fill_level_pct changed by < 2%
    urgent_bin_count unchanged
    critical_bin_count unchanged
  PUSH if any of the above changed

Step 2 — Enrich with job context
  Query f3.collection_jobs WHERE zone_id = ? AND state NOT IN
  ('COMPLETED','CANCELLED','FAILED')
  Add:
    active_jobs_count: number of active jobs in zone
    unassigned_urgent_bins: urgent bins with no active job

Step 3 — Publish to waste.bin.dashboard.updates
  event_type: 'zone:stats'
  Include enriched payload
```

**Cache (in-memory, 10 minute TTL):**

```typescript
interface ZoneStatsCache {
  lastAvgFill: number
  lastUrgentCount: number
  lastCriticalCount: number
  lastPublishedAt: number
}

const zoneCache = new Map<number, ZoneStatsCache>()
```

---

## 6. Dashboard publisher

**Topic published to:** `waste.bin.dashboard.updates`

All events published have this envelope:

```typescript
interface DashboardUpdateEvent {
  version: '1.0'
  source_service: 'bin-status-service'
  timestamp: string          // ISO 8601
  event_type: 'bin:update' | 'zone:stats' | 'alert:urgent'
  payload: BinUpdatePayload | ZoneStatsPayload | AlertPayload
}
```

### 6.1 bin:update payload

```typescript
interface BinUpdatePayload {
  bin_id: string
  cluster_id: string
  cluster_name: string
  zone_id: number
  fill_level_pct: number
  status: string
  urgency_score: number
  estimated_weight_kg: number
  waste_category: string
  waste_category_colour: string
  fill_rate_pct_per_hour: number
  predicted_full_at: string | null
  battery_level_pct: number
  has_active_job: boolean
  collection_triggered: boolean
  last_collected_at: string | null
}
```

### 6.2 zone:stats payload

```typescript
interface ZoneStatsPayload {
  zone_id: number
  zone_name: string
  avg_fill_level_pct: number
  urgent_bin_count: number
  critical_bin_count: number
  total_bins: number
  total_estimated_weight_kg: number
  dominant_waste_category: string
  category_breakdown: Record<string, {
    count: number
    avg_fill: number
    total_kg: number
  }>
  active_jobs_count: number
  unassigned_urgent_bins: number
}
```

### 6.3 alert:urgent payload

```typescript
interface AlertPayload {
  bin_id: string
  cluster_id: string
  zone_id: number
  urgency_score: number
  waste_category: string
  estimated_weight_kg: number
  predicted_full_at: string | null
  message: string
  // "BIN-047 is 85% full — no collection scheduled"
}
```

Alert is published when:
- `urgency_score >= 80`
- AND `has_active_job = false`
- AND `collection_triggered = true`

---

## 7. Internal API (for orchestrator)

These routes are NOT exposed via Kong. Cluster-internal only.

### POST /internal/clusters/:cluster_id/snapshot

Called by orchestrator after detecting an urgent bin.  
Returns the full state of all bins in the cluster.

**Request:**
```
POST /internal/clusters/CLUSTER-012/snapshot
Headers: X-Service-Name: workflow-orchestrator
         X-Trace-Id: {uuid}
```

**Response:**
```typescript
interface ClusterSnapshot {
  cluster_id: string
  cluster_name: string
  zone_id: number
  lat: number
  lng: number
  address: string
  total_bins: number
  has_active_job: boolean
  active_job_id: string | null
  bins: Array<{
    bin_id: string
    waste_category: string
    fill_level_pct: number
    status: string
    urgency_score: number
    estimated_weight_kg: number
    volume_litres: number
    avg_kg_per_litre: number
    predicted_full_at: string | null
    fill_rate_pct_per_hour: number
    should_collect: boolean
    // true if urgency_score >= 80 AND no active job
  }>
  // summary of bins that should be collected
  collectible_bins_count: number
  collectible_bins_weight_kg: number
  // total weight of all bins where should_collect = true
  highest_urgency_score: number
  highest_urgency_bin_id: string
}
```

**Error responses:**
```
404 { error: 'CLUSTER_NOT_FOUND', message: 'Cluster CLUSTER-999 does not exist' }
500 { error: 'INTERNAL_ERROR', message: '...' }
```

---

### POST /internal/clusters/:cluster_id/scan-nearby

Called by orchestrator during wait window to find other urgent clusters nearby.

**Request body:**
```typescript
{
  zone_id: number
  urgency_threshold: number        // scan for clusters >= this score
  within_minutes: number           // predicted to reach threshold within N minutes
  exclude_cluster_ids: string[]    // already included in current job
}
```

**Response:**
```typescript
{
  clusters: Array<{
    cluster_id: string
    cluster_name: string
    lat: number
    lng: number
    distance_km: number            // from triggering cluster
    highest_urgency_score: number
    predicted_urgent_at: string    // when it will cross threshold
    collectible_weight_kg: number
    bins_to_collect: string[]
  }>
}
```

---

### POST /internal/bins/:bin_id/mark-collected

Called by orchestrator when driver confirms collection in Flutter app.

**Request body:**
```typescript
{
  job_id: string
  driver_id: string
  collected_at: string             // ISO 8601
  fill_level_at_collection: number // actual fill level at collection time
  actual_weight_kg?: number        // if driver entered weight
}
```

**Processing:**
```
1. Update f2.bin_current_state:
   SET fill_level_pct = 0 (or fill_level_at_collection if provided)
   SET last_collected_at = collected_at
   SET status = 'normal'
   SET urgency_score = 0

2. Publish to waste.bin.dashboard.updates:
   event_type: 'bin:update'
   fill_level_pct: 0
   status: 'normal'
   urgency_score: 0
   (dashboard updates bin marker to green/collected)
```

**Response:**
```typescript
{ success: true, bin_id: string, collected_at: string }
```

---

## 8. Public API (via Kong — for dashboard)

All routes require valid Keycloak JWT.

### GET /api/v1/bins

Returns paginated list of bins with current state.

**Query parameters:**
```
zone_id        integer    filter by zone
status         string     normal | monitor | urgent | critical | offline
waste_category string     food_waste | paper | glass | plastic | general | e_waste
cluster_id     string     filter by cluster
page           integer    default 1
limit          integer    default 50, max 200
```

**Response:**
```typescript
{
  data: Array<{
    bin_id: string
    cluster_id: string
    cluster_name: string
    zone_id: number
    zone_name: string
    lat: number
    lng: number
    address: string
    fill_level_pct: number
    status: string
    urgency_score: number
    estimated_weight_kg: number
    waste_category: string
    waste_category_colour: string
    predicted_full_at: string | null
    battery_level_pct: number
    last_reading_at: string
    last_collected_at: string | null
    has_active_job: boolean
  }>
  total: number
  page: number
  limit: number
}
```

**Auth:** supervisor, fleet-operator, viewer

---

### GET /api/v1/bins/:bin_id

Returns full detail for a single bin including recent collection history.

**Response:**
```typescript
{
  // all fields from list response
  // plus:
  volume_litres: number
  bin_depth_cm: number
  installed_at: string
  last_maintained_at: string | null
  recent_collections: Array<{
    job_id: string
    collected_at: string
    driver_id: string
    fill_level_at_collection: number
    actual_weight_kg: number | null
    job_type: 'routine' | 'emergency'
  }>
  // last 10 collections
}
```

**Auth:** all authenticated roles

---

### GET /api/v1/bins/:bin_id/history

Returns fill level time-series from InfluxDB.

**Query parameters:**
```
from       ISO 8601     start of range (default: -7d)
to         ISO 8601     end of range (default: now)
interval   string       1h | 6h | 1d (aggregation interval, default: 1h)
```

**Response:**
```typescript
{
  bin_id: string
  from: string
  to: string
  interval: string
  series: Array<{
    timestamp: string
    fill_level_pct: number
    urgency_score: number
    estimated_weight_kg: number
  }>
  collection_events: Array<{
    collected_at: string
    fill_level_at_collection: number
  }>
  // overlaid on the chart to show when bin was emptied
}
```

**Auth:** supervisor, viewer

---

### GET /api/v1/clusters/:cluster_id

Returns full cluster state with all bins.

**Response:**
```typescript
{
  cluster_id: string
  cluster_name: string
  zone_id: number
  zone_name: string
  lat: number
  lng: number
  address: string
  bins: Array<{
    bin_id: string
    waste_category: string
    waste_category_colour: string
    fill_level_pct: number
    status: string
    urgency_score: number
    estimated_weight_kg: number
    predicted_full_at: string | null
  }>
  summary: {
    total_bins: number
    urgent_bins: number
    critical_bins: number
    total_weight_kg: number
    highest_urgency_score: number
    has_active_job: boolean
    active_job_id: string | null
  }
}
```

**Auth:** all authenticated roles

---

### GET /api/v1/zones/:zone_id/summary

Returns zone overview.

**Response:**
```typescript
{
  zone_id: number
  zone_name: string
  total_bins: number
  total_clusters: number
  status_breakdown: {
    normal: number
    monitor: number
    urgent: number
    critical: number
    offline: number
  }
  category_breakdown: Record<string, {
    total_bins: number
    avg_fill_pct: number
    total_weight_kg: number
    urgent_count: number
  }>
  total_estimated_weight_kg: number
  active_jobs_count: number
  last_updated: string
}
```

**Auth:** supervisor, fleet-operator, viewer

---

## 9. Error handling

### Kafka consumer errors

```typescript
// If processing a single message fails — log and continue
// Do NOT throw — a single bad message must not stop the consumer

try {
  await processMessage(message)
  await consumer.commitOffsets([...])
} catch (error) {
  logger.error({
    message: 'Failed to process bin processed event',
    bin_id: payload.bin_id,
    error: error.message,
    offset: message.offset,
    traceId
  })
  // Skip this message, commit offset, continue
  await consumer.commitOffsets([...])
}
```

### Database connection failure

```typescript
// On startup — retry connection 5 times with exponential backoff
// If DB unavailable after retries — log CRITICAL and exit process
// Kubernetes will restart the pod
// Do not accept Kafka messages until DB is confirmed healthy
```

### InfluxDB unavailable

```typescript
// History queries (GET /bins/:id/history) — return 503
// Do NOT block Kafka consumer processing
// Log warning and continue — InfluxDB is not critical path
```

### Missing bin metadata

```typescript
// If bin_id in Kafka message not found in f2.bins:
// Log warning — sensor might have been registered late
// Skip the message
// Do NOT crash
```

---

## 10. Weight calculation — canonical implementation

This is the single source of truth for weight calculation in F3.

```typescript
// rules/weightCalculator.ts

export function calculateBinWeight(
  fillLevelPct: number,
  volumeLitres: number,
  avgKgPerLitre: number
): number {
  if (fillLevelPct < 0 || fillLevelPct > 100) {
    throw new Error(`Invalid fill level: ${fillLevelPct}`)
  }
  return parseFloat(
    ((fillLevelPct / 100) * volumeLitres * avgKgPerLitre).toFixed(2)
  )
}

// Example:
// Glass bin, 240L, 85% full
// (85/100) × 240 × 2.500 = 510.00 kg
```

All F3 services import this function from the shared-types package. Never recalculate inline.

---

## 11. Acceptance criteria

The service is considered complete when all of the following pass:

```
[ ] Consumer: processes waste.bin.processed messages
[ ] Consumer: correctly calculates estimated_weight_kg using waste category metadata
[ ] Consumer: applies urgency classification rules
[ ] Consumer: applies smart filtering (normal bins throttled, urgent always pushed)
[ ] Consumer: publishes enriched events to waste.bin.dashboard.updates
[ ] Consumer: processes waste.zone.statistics messages
[ ] Consumer: suppresses zone stats when change is below threshold
[ ] Consumer: enriches zone stats with active job count
[ ] API: GET /internal/clusters/:id/snapshot returns correct cluster state
[ ] API: GET /internal/clusters/:id/snapshot returns has_active_job correctly
[ ] API: POST /internal/clusters/:id/scan-nearby returns nearby urgent clusters
[ ] API: POST /internal/bins/:id/mark-collected resets bin fill to 0
[ ] API: POST /internal/bins/:id/mark-collected publishes dashboard update
[ ] API: GET /api/v1/bins returns paginated, filterable bin list
[ ] API: GET /api/v1/bins/:id/history queries InfluxDB correctly
[ ] API: All public routes return 401 without valid JWT
[ ] API: Supervisor role can access all routes
[ ] API: Driver role cannot access bin history routes
[ ] Error: Bad Kafka message does not crash consumer
[ ] Error: InfluxDB unavailable does not block Kafka processing
[ ] Performance: /api/v1/bins for 1000 bins responds in < 200ms
```

---

## 12. Test cases

### Unit tests

```
weightCalculator.ts
  ✓ glass bin 240L at 85% → 510.00 kg
  ✓ plastic bin 120L at 100% → 6.00 kg
  ✓ food_waste bin 240L at 50% → 108.00 kg
  ✓ fill level 0% → 0.00 kg
  ✓ fill level > 100% → throws error

dashboardFilter.ts
  ✓ urgent bin always passes filter
  ✓ normal bin suppressed if pushed < 60s ago
  ✓ normal bin passes filter if pushed > 60s ago
  ✓ status change (normal → monitor) always passes
  ✓ bin with active job suppressed

collectionTrigger.ts
  ✓ urgency >= 80 + no active job → collection_triggered = true
  ✓ urgency >= 80 + active job exists → collection_triggered = false
  ✓ urgency < 80 → collection_triggered = false
```

### Integration tests

```
Kafka consumer
  ✓ Publishes to waste.bin.dashboard.updates when filter passes
  ✓ Does not publish when filter suppresses
  ✓ Commits Kafka offset after processing
  ✓ Continues after processing error (does not crash)

Cluster snapshot API
  ✓ Returns all bins in cluster
  ✓ Correctly identifies collectible bins (urgency >= 80)
  ✓ Calculates collectible_bins_weight_kg correctly
  ✓ Returns 404 for non-existent cluster
```
