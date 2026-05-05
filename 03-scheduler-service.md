# Technical Specification — Scheduler Service
**Owner:** F3  
**Repo:** group-f-application/scheduler-service  
**Version:** 1.0  
**Stack:** Node.js 20 · TypeScript · Fastify · Prisma · KafkaJS

---

## 1. Purpose

The scheduler service handles everything related to vehicle dispatch and job execution tracking. It is the only service that knows which vehicle is going where, what cargo it is carrying, and where it is on the road in real time.

When the orchestrator decides a collection job needs dispatching, the scheduler takes full ownership — it calls OR-Tools for the route, selects the right vehicle, notifies the driver, and then tracks the entire job execution through GPS.

---

## 2. Context in the system

```
Orchestrator ──► POST /internal/scheduler/dispatch
                       │
                       ├── POST /internal/route-optimizer/solve  (OR-Tools)
                       ├── Selects vehicle
                       ├── POST /internal/notify/job-assigned    (Notification)
                       └── Returns dispatch result to orchestrator

waste.vehicle.location ──► Scheduler ──► POST /internal/notify/vehicle-position
waste.vehicle.deviation ──► Scheduler ──► POST /internal/notify/alert-deviation

Flutter driver app ──► POST /api/v1/collections/:id/bins/:bin_id/collected
```

---

## 3. Responsibilities

- Receive dispatch requests from orchestrator
- Call OR-Tools route optimizer internally
- Select appropriate vehicle based on weight and waste category
- Store route plan
- Call notification service to push job to driver
- Consume `waste.vehicle.location` — track real-time vehicle positions
- Consume `waste.vehicle.deviation` — handle deviation alerts
- Enrich vehicle position data with job context before forwarding to notification
- Track bin-by-bin collection progress
- Monitor vehicle cargo weight accumulation
- Alert orchestrator when vehicle approaches weight limit
- Update driver status on job completion

---

## 4. Vehicle types

```typescript
// The system has four vehicle types defined by max_cargo_kg

enum VehicleType {
  SMALL       = 'small',       // ~2,000 kg  — roughly 2 clusters
  MEDIUM      = 'medium',      // ~8,000 kg  — roughly quarter zone
  LARGE       = 'large',       // ~15,000 kg — roughly half zone
  EXTRA_LARGE = 'extra_large'  // ~25,000 kg — roughly full zone
}

// Each vehicle in f2.vehicles has:
//   max_cargo_kg: the precise weight limit
//   waste_categories_supported: which types it accepts
//   driver_id: one vehicle, one driver (always available assumption)
```

**Vehicle selection rule:**

```
Find the smallest vehicle that:
  1. Has max_cargo_kg >= job total_estimated_weight_kg
  2. Supports the waste_category of the job's bins
  3. Is currently status = 'available'
  4. Its driver has no active job

Order candidates by max_cargo_kg ASC — smallest sufficient vehicle first
This avoids wasting a large lorry on a small job
```

---

## 5. Dispatch flow

### POST /internal/scheduler/dispatch

Called by the orchestrator. This is the main entry point.

**Request body:**
```typescript
interface DispatchRequest {
  job_id: string
  clusters: Array<{
    cluster_id: string
    lat: number
    lng: number
    cluster_name: string
  }>
  bins_to_collect: Array<{
    bin_id: string
    cluster_id: string
    lat: number
    lng: number
    waste_category: string
    fill_level_pct: number
    estimated_weight_kg: number
    urgency_score: number
    predicted_full_at: string | null
  }>
  total_estimated_weight_kg: number
  waste_category: string          // dominant category of the job
  zone_id: number
  priority: number                // 1–10
}
```

**Internal processing:**

```
Step 1 — Find available vehicles
  Query f2.vehicles via Prisma:
    active = true
    status = 'available'
    max_cargo_kg >= total_estimated_weight_kg
    waste_category in waste_categories_supported
  Order by max_cargo_kg ASC
  If none found → return { success: false, reason: 'NO_VEHICLE_AVAILABLE' }

Step 2 — Call OR-Tools
  POST /internal/route-optimizer/solve
  (OR-Tools runs inside the cluster — not exposed externally)
  Body: {
    clusters: [...],
    bins: [...],
    available_vehicles: [{ vehicle_id, max_cargo_kg, lat, lng }],
    depot: { lat, lng },
    constraints: {
      time_windows_per_bin: derived from urgency_score,
      max_cargo_kg_per_vehicle: from vehicles,
      waste_category_per_vehicle: from vehicles
    }
  }
  Timeout: 35 seconds
  If timeout → use fallback nearest-neighbour (see Section 6)

Step 3 — Parse OR-Tools response
  response: {
    vehicle_id: string,
    waypoints: Array<{
      cluster_id, bins, estimated_arrival, cumulative_weight_kg
    }>,
    total_distance_km, estimated_minutes
  }

Step 4 — Assign vehicle
  UPDATE f2.vehicles SET status = 'dispatched'
  (via direct DB write — scheduler has write access to vehicles status)

Step 5 — Store route plan
  INSERT INTO f2.route_plans:
    job_id, vehicle_id, route_type = 'emergency',
    zone_id, waypoints (JSONB), total_bins,
    estimated_weight_kg, estimated_distance_km, estimated_minutes

  INSERT INTO f3.bin_collection_records for each bin:
    job_id, bin_id, sequence_number, planned_arrival_at,
    estimated_weight_kg (status: pending)

Step 6 — Call notification service
  POST /internal/notify/job-assigned
  Body: {
    driver_id: vehicle.driver_id,
    vehicle_id,
    job_id,
    clusters,
    route: waypoints,
    estimated_duration_min
  }
  (notification service pushes FCM + Socket.IO to driver's Flutter app)

Step 7 — Return to orchestrator
  {
    success: true,
    vehicle_id,
    driver_id: vehicle.driver_id,
    route_plan_id,
    estimated_minutes,
    route: waypoints
  }
```

---

## 6. OR-Tools fallback

If OR-Tools times out after 35 seconds:

```typescript
function nearestNeighbourFallback(
  bins: BinToCollect[],
  depot: { lat: number, lng: number }
): Waypoint[] {

  const remaining = [...bins]
  const route: Waypoint[] = []
  let current = depot

  while (remaining.length > 0) {
    // Find nearest unvisited bin
    let nearest = remaining[0]
    let minDist = haversineKm(current.lat, current.lng,
                              nearest.lat, nearest.lng)

    for (const bin of remaining) {
      const d = haversineKm(current.lat, current.lng, bin.lat, bin.lng)
      if (d < minDist) {
        nearest = bin
        minDist = d
      }
    }

    route.push({
      cluster_id: nearest.cluster_id,
      bins: [nearest.bin_id],
      estimated_arrival: null,  // unknown with fallback
      cumulative_weight_kg: 0   // recalculate after
    })

    current = { lat: nearest.lat, lng: nearest.lng }
    remaining.splice(remaining.indexOf(nearest), 1)
  }

  // Log that fallback was used
  logger.warn({ message: 'OR-Tools timed out, using nearest-neighbour fallback', job_id })

  return route
}
```

---

## 7. Real-time vehicle tracking

### Consuming waste.vehicle.location

**Topic:** `waste.vehicle.location`  
**Group ID:** `scheduler-vehicle-tracker`

```typescript
interface VehicleLocationEvent {
  version: string
  source_service: 'flutter-app'
  timestamp: string
  payload: {
    vehicle_id: string
    driver_id: string
    lat: number
    lng: number
    speed_kmh: number
    heading_degrees: number
    accuracy_m: number
  }
}
```

**Processing logic per GPS ping:**

```
Step 1 — Load active job for this vehicle
  Query f3.collection_jobs WHERE
    assigned_vehicle_id = vehicle_id
    AND state = 'IN_PROGRESS'
  If no active job → throttle: only forward position every 30s

Step 2 — Enrich with job context
  Enrich payload:
    + job_id
    + driver_id (from job)
    + current_cluster: nearest cluster on route not yet completed
    + next_cluster: cluster after current
    + bins_collected: count of collected bins in this job
    + bins_total: total bins in job
    + cargo_weight_kg: sum of estimated_weight_kg of collected bins
    + cargo_limit_kg: vehicle.max_cargo_kg
    + cargo_utilisation_pct: (cargo_weight_kg / cargo_limit_kg) × 100

Step 3 — Proximity check
  For each uncollected bin in the job:
    distance = haversine(vehicle_lat, vehicle_lng, bin_lat, bin_lng)
    If distance < 50m AND bin not yet marked arrived:
      UPDATE bin_collection_records SET arrived_at = NOW()
      Include in enriched payload: arrived_at_bin: bin_id

Step 4 — Smart filtering
  Always forward: vehicle on active job
  Throttle to 1/30s: vehicle dispatched but not yet IN_PROGRESS
  Never forward: vehicle off duty or available

Step 5 — Publish to waste.vehicle.dashboard.updates
  event_type: 'vehicle:position'
  Full enriched payload
  (Notification service streams to dashboard Socket.IO)

Step 6 — Write to InfluxDB
  measurement: vehicle_positions
  Happens regardless of filtering — all positions stored
```

---

### Consuming waste.vehicle.deviation

**Topic:** `waste.vehicle.deviation`  
**Group ID:** `scheduler-deviation-handler`

```typescript
interface VehicleDeviationEvent {
  payload: {
    vehicle_id: string
    job_id: string
    deviation_metres: number
    duration_seconds: number
    current_lat: number
    current_lng: number
  }
}
```

**Processing:**

```
Load job and driver details from job_id
Call notification service:
  POST /internal/notify/alert-deviation
  Body: {
    vehicle_id, driver_id, job_id,
    deviation_metres, duration_seconds,
    message: "LORRY-03 is 650m off planned route"
  }
Notification service → Socket.IO alert to fleet-ops room
```

---

## 8. Driver collection API (called by Flutter)

### POST /api/v1/collections/:job_id/bins/:bin_id/collected

Driver taps "Collected" in Flutter app.

**Request body:**
```typescript
{
  fill_level_at_collection: number   // sensor reading at time of collection
  gps_lat: number
  gps_lng: number
  actual_weight_kg?: number          // optional, if vehicle has scale
  notes?: string
  photo_url?: string
}
```

**Processing:**

```
Step 1 — Validate
  job must exist and be IN_PROGRESS
  JWT must belong to assigned_driver_id
  bin must be in this job's bin_collection_records
  bin must not already be marked collected

Step 2 — Update collection record
  UPDATE f3.bin_collection_records SET:
    collected_at = NOW()
    fill_level_at_collection
    actual_weight_kg (if provided)
    gps_lat, gps_lng
    notes, photo_url

Step 3 — Update cargo tracking
  Recalculate cumulative cargo weight:
    SELECT SUM(estimated_weight_kg) FROM bin_collection_records
    WHERE job_id = ? AND collected_at IS NOT NULL

  If cumulative weight >= vehicle.max_cargo_kg × 0.90:
    Log warning: approaching weight limit
    Include in next vehicle:position update:
      weight_limit_warning: true

  If cumulative weight >= vehicle.max_cargo_kg:
    Notify orchestrator: vehicle full
    POST /internal/jobs/:job_id/vehicle-full
    Orchestrator creates new job for remaining bins

Step 4 — Check job completion
  Are all bins either collected or skipped?
  If yes → notify orchestrator: job complete
    POST /internal/jobs/:job_id/complete
    (with full collection data)

Step 5 — Publish dashboard update
  Call notification service via Kafka is handled by next GPS ping
  The enriched vehicle:position will reflect updated progress

Step 6 — Return
  {
    success: true,
    bin_id,
    job_progress: {
      bins_collected: number,
      bins_skipped: number,
      bins_pending: number,
      cargo_weight_kg: number,
      cargo_limit_kg: number,
      job_complete: boolean
    }
  }
```

**Auth:** driver role — must be the assigned driver for this job

---

### POST /api/v1/collections/:job_id/bins/:bin_id/skip

Driver marks a bin as unable to collect.

**Request body:**
```typescript
{
  reason: 'locked' | 'inaccessible' | 'already_empty' | 'hazardous' | 'bin_missing' | 'other'
  notes?: string
}
```

**Processing:**

```
UPDATE bin_collection_records SET:
  skipped_at = NOW()
  skip_reason = reason
  skip_notes = notes

Check job completion (same as collected)
Return updated job progress
```

**Auth:** driver role — must be assigned driver

---

## 9. Read APIs (for dashboard)

### GET /api/v1/vehicles/active

Returns all vehicles currently dispatched or in progress.

**Response:**
```typescript
{
  vehicles: Array<{
    vehicle_id: string
    vehicle_type: string
    driver_id: string
    driver_name: string
    job_id: string
    job_type: string
    zone_id: number
    state: string
    current_lat: number | null
    current_lng: number | null
    last_seen_at: string | null
    cargo_weight_kg: number
    cargo_limit_kg: number
    cargo_utilisation_pct: number
    bins_collected: number
    bins_total: number
  }>
}
```

**Auth:** supervisor, fleet-operator

---

### GET /api/v1/jobs/:job_id/progress

Live progress of a specific job.

**Response:**
```typescript
{
  job_id: string
  state: string
  vehicle_id: string
  driver_id: string
  driver_name: string
  total_bins: number
  bins_collected: number
  bins_skipped: number
  bins_pending: number
  cargo_weight_kg: number
  cargo_limit_kg: number
  cargo_utilisation_pct: number
  estimated_completion_at: string | null
  current_stop: {
    cluster_id: string
    cluster_name: string
    bins_at_stop: number
    bins_collected_at_stop: number
  } | null
  waypoints: Array<{
    sequence: number
    cluster_id: string
    cluster_name: string
    bins: string[]
    status: 'completed' | 'current' | 'pending'
    arrived_at: string | null
    completed_at: string | null
  }>
}
```

**Auth:** supervisor, fleet-operator, driver (own job only)

---

### GET /api/v1/drivers/available

**Response:**
```typescript
{
  drivers: Array<{
    driver_id: string
    driver_name: string
    vehicle_id: string
    vehicle_type: string
    zone_id: number
    status: string
  }>
}
```

**Auth:** supervisor, fleet-operator

---

## 10. Acceptance criteria

```
[ ] Dispatch: selects smallest sufficient vehicle for job weight
[ ] Dispatch: calls OR-Tools with correct cluster + bin payload
[ ] Dispatch: falls back to nearest-neighbour if OR-Tools times out
[ ] Dispatch: stores route plan in f2.route_plans
[ ] Dispatch: creates bin_collection_records for each bin
[ ] Dispatch: calls notification service with driver push
[ ] Dispatch: returns vehicle_id, driver_id, route to orchestrator
[ ] Tracking: consumes waste.vehicle.location
[ ] Tracking: enriches GPS with job context (cargo, progress, next stop)
[ ] Tracking: detects proximity to bin stops (< 50m)
[ ] Tracking: publishes to waste.vehicle.dashboard.updates
[ ] Tracking: writes all positions to InfluxDB
[ ] Deviation: consumes waste.vehicle.deviation
[ ] Deviation: forwards alert to notification service
[ ] Collection: POST collected updates bin_collection_records
[ ] Collection: tracks cumulative cargo weight
[ ] Collection: alerts orchestrator when vehicle full
[ ] Collection: detects job completion and notifies orchestrator
[ ] Collection: skipped bins correctly marked
[ ] APIs: vehicle/active returns correct real-time state
[ ] APIs: job progress returns bin-level detail
[ ] Auth: driver can only mark bins on their own assigned job
```
