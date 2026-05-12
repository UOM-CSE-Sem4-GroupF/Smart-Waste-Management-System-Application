# F3 Services Public API Guide

Public APIs exposed by the **Scheduler**, **Bin-Status**, and **Orchestrator** services for external integration (e.g., Dashboard, Driver App).

---

## Service Connectivity

| Service | Local Port | K8s DNS |
|---|---|---|
| Scheduler | `http://localhost:3003` | `http://scheduler-base-service.waste-dev.svc.cluster.local:3003` |
| Bin-Status | `http://localhost:3002` | `http://bin-status-base-service.waste-dev.svc.cluster.local:3002` |
| Orchestrator | `http://localhost:3001` | `http://orchestrator-base-service.waste-dev.svc.cluster.local:3001` |

---

## 1. Scheduler Service

### 1.1 Bin Collected (Driver App)

`POST /api/v1/collections/:job_id/bins/:bin_id/collected`

Driver app calls this when a bin is physically collected. Writes to `f3.bin_collection_records`.

**Request Body**
```json
{
  "fill_level_at_collection": 91.5,
  "gps_lat": 6.8831,
  "gps_lng": 79.8612,
  "actual_weight_kg": 43.2,
  "notes": "Bin lid was damaged",
  "photo_url": "https://storage.example.com/photos/bin-001.jpg"
}
```

> `actual_weight_kg`, `notes`, `photo_url` are optional.

**Response 200**
```json
{
  "success": true,
  "bin_id": "BIN-001",
  "job_progress": {
    "bins_collected": 3,
    "bins_skipped": 0,
    "bins_pending": 2,
    "cargo_weight_kg": 130.5,
    "cargo_limit_kg": 8000,
    "job_complete": false
  }
}
```

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Job JOB-001 not found or not in progress" }
```

**Response 409**
```json
{ "error": "BIN_ALREADY_COLLECTED", "message": "Bin BIN-001 already collected" }
```

---

### 1.2 Skip Bin (Driver App)

`POST /api/v1/collections/:job_id/bins/:bin_id/skip`

Driver app calls this to skip a bin. Writes `skipped_at` and `skip_reason` to `f3.bin_collection_records`.

**Request Body**
```json
{
  "reason": "inaccessible",
  "notes": "Gate was locked, could not reach bin"
}
```

> `reason` is required. Valid values: `locked` | `inaccessible` | `already_empty` | `hazardous` | `bin_missing` | `other`  
> `notes` is optional.

**Response 200**
```json
{
  "success": true,
  "bin_id": "BIN-002",
  "job_progress": {
    "bins_collected": 3,
    "bins_skipped": 1,
    "bins_pending": 1,
    "cargo_weight_kg": 130.5,
    "cargo_limit_kg": 8000,
    "job_complete": false
  }
}
```

**Response 400**
```json
{ "error": "VALIDATION_ERROR", "message": "reason is required" }
```

**Response 409**
```json
{ "error": "BIN_ALREADY_PROCESSED", "message": "Bin BIN-002 already processed" }
```

---

### 1.3 Job Progress

`GET /api/v1/jobs/:job_id/progress`

Returns live collection progress for an active job. Reads from `f3.bin_collection_records`.

**Response 200**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "IN_PROGRESS",
  "vehicle_id": "LORRY-001",
  "driver_id": "DRV-001",
  "driver_name": "Unknown",
  "total_bins": 5,
  "bins_collected": 3,
  "bins_skipped": 0,
  "bins_pending": 2,
  "cargo_weight_kg": 130.5,
  "cargo_limit_kg": 8000,
  "cargo_utilisation_pct": 1.63,
  "estimated_completion_at": null,
  "current_stop": null,
  "waypoints": []
}
```

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Job JOB-001 not found" }
```

---

### 1.4 Active Vehicles

`GET /api/v1/vehicles/active`

Returns all vehicles currently DISPATCHED or IN_PROGRESS. Reads from in-memory store (populated from Kafka vehicle location events and dispatch records).

**Response 200**
```json
{
  "vehicles": [
    {
      "vehicle_id": "LORRY-001",
      "vehicle_type": "large",
      "driver_id": "DRV-001",
      "driver_name": "Amal Perera",
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_type": "emergency",
      "zone_id": 1,
      "state": "dispatched",
      "current_lat": 6.8831,
      "current_lng": 79.8612,
      "last_seen_at": "2026-05-12T09:10:00Z",
      "cargo_weight_kg": 0,
      "cargo_limit_kg": 15000,
      "cargo_utilisation_pct": 0,
      "bins_collected": 0,
      "bins_total": 5
    }
  ]
}
```

---

### 1.5 Available Drivers (In-Memory)

`GET /api/v1/drivers/available`

Returns drivers with `status = available` from in-memory store (seed or Kafka-updated).

**Response 200**
```json
{
  "drivers": [
    {
      "driver_id": "DRV-002",
      "driver_name": "Nimal Silva",
      "vehicle_id": "LORRY-002",
      "vehicle_type": "medium",
      "zone_id": 2,
      "status": "available"
    }
  ]
}
```

---

### 1.6 List Drivers (F3 DB)

`GET /api/v1/drivers`

**Query Params**: `zone_id` (optional), `limit` (default 50), `offset` (default 0)

**Response 200**
```json
{
  "data": [
    {
      "driver_id": "DRV-001",
      "name": "Amal Perera",
      "vehicle_id": "LORRY-001",
      "vehicle_type": "large_truck",
      "zone_id": 1,
      "status": "available"
    }
  ],
  "total": 5
}
```

---

### 1.7 Get Single Driver (F3 DB)

`GET /api/v1/drivers/:id`

**Response 200**
```json
{
  "driver_id": "DRV-001",
  "name": "Amal Perera",
  "vehicle_id": "LORRY-001",
  "vehicle_type": "large_truck",
  "zone_id": 1,
  "status": "available"
}
```

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Driver DRV-099 not found" }
```

---

### 1.8 Create Driver (F3 DB)

`POST /api/v1/drivers`

Creates a new driver record in `f3.drivers`.

**Request Body**
```json
{
  "driver_id": "DRV-006",
  "name": "Suresh Mendis",
  "zone_id": 3,
  "vehicle_id": "LORRY-006"
}
```

> `zone_id` and `vehicle_id` are optional (default to 0 / null).

**Response 201**
```json
{
  "driver_id": "DRV-006",
  "name": "Suresh Mendis",
  "vehicle_id": "LORRY-006",
  "vehicle_type": "large_truck",
  "zone_id": 3,
  "status": "available"
}
```

**Response 400**
```json
{ "error": "VALIDATION_ERROR", "message": "driver_id and name are required" }
```

**Response 409**
```json
{ "error": "CONFLICT", "message": "Driver DRV-006 already exists" }
```

---

### 1.9 Update Driver (F3 DB)

`PATCH /api/v1/drivers/:id`

Updates driver fields in `f3.drivers`. Only `name`, `zone_id`, `vehicle_id`, and `status` are accepted — other fields are silently ignored.

**Request Body** (all fields optional)
```json
{
  "name": "Suresh K. Mendis",
  "zone_id": 2,
  "vehicle_id": "TRUCK-001",
  "status": "on_job"
}
```

> Valid `status` values: `available` | `on_job` | `off_duty` | `on_break`

**Response 200**
```json
{
  "driver_id": "DRV-006",
  "name": "Suresh K. Mendis",
  "vehicle_id": "TRUCK-001",
  "vehicle_type": "medium_truck",
  "zone_id": 2,
  "status": "on_job"
}
```

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Driver DRV-099 not found" }
```

---

## 2. Bin-Status Service

### 2.1 List Bins (Live State)

`GET /api/v1/bins`

Returns all bins from the in-memory store (populated by Kafka `waste.bin.processed` events from Flink).

**Query Params** (all optional)

| Param | Type | Example |
|---|---|---|
| `zone_id` | string | `1` |
| `status` | string | `urgent` |
| `waste_category` | string | `general` |
| `cluster_id` | string | `CLUSTER-001` |
| `page` | string | `1` |
| `limit` | string | `50` (max 200) |

**Response 200**
```json
{
  "data": [
    {
      "bin_id": "BIN-001",
      "cluster_id": "CLUSTER-001",
      "cluster_name": "Main Street Cluster",
      "zone_id": 1,
      "zone_name": "Zone 1",
      "lat": 6.8831,
      "lng": 79.8612,
      "address": "Main Waste Center",
      "fill_level_pct": 93.5,
      "status": "critical",
      "urgency_score": 92,
      "estimated_weight_kg": 33.66,
      "waste_category": "general",
      "waste_category_colour": "#FF5733",
      "predicted_full_at": "2026-05-12T10:30:00Z",
      "battery_level_pct": 85,
      "last_reading_at": "2026-05-12T09:00:00Z",
      "last_collected_at": "2026-05-10T14:20:00Z",
      "has_active_job": false
    }
  ],
  "total": 48,
  "page": 1,
  "limit": 50
}
```

> `status` values: `normal` | `monitor` | `urgent` | `critical` | `offline`

---

### 2.2 Get Single Bin

`GET /api/v1/bins/:bin_id`

**Response 200**
```json
{
  "bin_id": "BIN-001",
  "cluster_id": "CLUSTER-001",
  "cluster_name": "Main Street Cluster",
  "zone_id": "1",
  "lat": 6.8831,
  "lng": 79.8612,
  "fill_level_pct": 93.5,
  "status": "critical",
  "urgency_score": 92,
  "estimated_weight_kg": 33.66,
  "waste_category": "general",
  "waste_category_colour": "#FF5733",
  "predicted_full_at": "2026-05-12T10:30:00Z",
  "battery_level_pct": 85,
  "last_reading_at": "2026-05-12T09:00:00Z",
  "last_collected_at": "2026-05-10T14:20:00Z",
  "has_active_job": false,
  "recent_collections": [
    {
      "job_id": "JOB-abc123",
      "collected_at": "2026-05-10T14:20:00Z",
      "driver_id": "DRIVER-001",
      "fill_level_at_collection": 91.0,
      "actual_weight_kg": null,
      "job_type": "emergency"
    }
  ]
}
```

---

### 2.3 Bin Fill History

`GET /api/v1/bins/:bin_id/history`

**Query Params** (all optional)

| Param | Default | Example |
|---|---|---|
| `from` | 7 days ago | `2026-05-05T00:00:00Z` |
| `to` | now | `2026-05-12T00:00:00Z` |
| `interval` | `1h` | `30m` |

**Response 200**
```json
{
  "bin_id": "BIN-001",
  "from": "2026-05-05T00:00:00Z",
  "to": "2026-05-12T00:00:00Z",
  "interval": "1h",
  "series": [
    {
      "timestamp": "2026-05-11T08:00:00Z",
      "fill_level_pct": 45.2,
      "urgency_score": 38,
      "estimated_weight_kg": 16.27
    }
  ],
  "collection_events": [
    {
      "collected_at": "2026-05-10T14:20:00Z",
      "fill_level_at_collection": 91.0
    }
  ]
}
```

---

### 2.4 Cluster Detail

`GET /api/v1/clusters/:cluster_id`

**Response 200**
```json
{
  "cluster_id": "CLUSTER-001",
  "cluster_name": "Main Depot",
  "zone_id": 1,
  "zone_name": "Zone 1",
  "lat": 6.8831,
  "lng": 79.8612,
  "address": "Main Waste Management Center",
  "bins": [
    {
      "bin_id": "BIN-001",
      "waste_category": "general",
      "waste_category_colour": "#FF5733",
      "fill_level_pct": 93.5,
      "status": "critical",
      "urgency_score": 92,
      "estimated_weight_kg": 33.66,
      "predicted_full_at": "2026-05-12T10:30:00Z"
    }
  ],
  "summary": {
    "total_bins": 4,
    "urgent_bins": 1,
    "critical_bins": 2,
    "total_weight_kg": 88.50,
    "highest_urgency_score": 92,
    "has_active_job": false,
    "active_job_id": null
  }
}
```

---

### 2.5 Zone Summary

`GET /api/v1/zones/:zone_id/summary`

**Response 200**
```json
{
  "zone_id": 1,
  "zone_name": "Zone 1",
  "total_bins": 48,
  "total_clusters": 12,
  "status_breakdown": {
    "normal": 28,
    "monitor": 10,
    "urgent": 6,
    "critical": 3,
    "offline": 1
  },
  "category_breakdown": {
    "general": {
      "total_bins": 20,
      "total_weight_kg": 240.50,
      "urgent_count": 4,
      "avg_fill_pct": 55.30
    },
    "food_waste": {
      "total_bins": 15,
      "total_weight_kg": 810.00,
      "urgent_count": 2,
      "avg_fill_pct": 48.10
    }
  },
  "total_estimated_weight_kg": 1850.25,
  "active_jobs_count": 1,
  "last_updated": "2026-05-12T09:00:00Z"
}
```

---

### 2.6 List Zones

`GET /api/v1/zones`

**Response 200**
```json
{
  "data": [
    {
      "zone_id": "1",
      "zone_name": "Zone 1",
      "bin_count": 48,
      "avg_fill_pct": 52.3,
      "total_estimated_weight_kg": 1850.25,
      "urgent_bins": 6,
      "critical_bins": 3,
      "active_jobs": 1
    }
  ]
}
```

---

## 3. Orchestrator Service

### 3.1 List Collection Jobs (F3 DB)

`GET /api/v1/collection-jobs`

Reads from `f3.collection_jobs` with optional filters.

**Query Params** (all optional)

| Param | Example | Notes |
|---|---|---|
| `job_type` | `emergency` | `emergency` or `routine` |
| `state` | `IN_PROGRESS` | See state machine below |
| `zone_id` | `1` | Integer |
| `date_from` | `2026-05-01T00:00:00Z` | ISO 8601 |
| `date_to` | `2026-05-12T23:59:59Z` | ISO 8601 |
| `page` | `1` | Default 1 |
| `limit` | `20` | Default 20, max 100 |

**Response 200**
```json
{
  "data": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_type": "emergency",
      "state": "IN_PROGRESS",
      "zone_id": "1",
      "waste_category": "general",
      "trigger_bin_id": "BIN-003",
      "trigger_urgency_score": 92,
      "clusters": ["CLUSTER-001", "CLUSTER-005"],
      "bins_to_collect": ["BIN-003", "BIN-004", "BIN-022"],
      "assigned_vehicle_id": "LORRY-001",
      "assigned_driver_id": "DRV-001",
      "route_plan_id": "f7a1c3e0-44bb-4c2a-9b23-1234567890ab",
      "planned_weight_kg": 132.60,
      "created_at": "2026-05-12T09:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

**Job state machine:**
`CREATED` → `BIN_CONFIRMING` → `BIN_CONFIRMED` → `CLUSTER_ASSEMBLING` → `CLUSTER_ASSEMBLED` → `DISPATCHING` → `DISPATCHED` → `DRIVER_NOTIFIED` → `IN_PROGRESS` → `COMPLETING` → `COLLECTION_DONE` → `RECORDING_AUDIT` → `AUDIT_RECORDED` → `COMPLETED`

Terminal failure states: `FAILED` | `ESCALATED` | `CANCELLED` | `AUDIT_FAILED`

---

### 3.2 Get Single Collection Job (F3 DB)

`GET /api/v1/collection-jobs/:id`

Returns the full job record including complete state transition history and step execution log.

**Response 200**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "emergency",
  "state": "COMPLETED",
  "zone_id": "1",
  "waste_category": "general",
  "trigger_bin_id": "BIN-003",
  "trigger_urgency_score": 92,
  "clusters": ["CLUSTER-001"],
  "bins_to_collect": ["BIN-003", "BIN-004"],
  "assigned_vehicle_id": "LORRY-001",
  "assigned_driver_id": "DRV-001",
  "route_plan_id": "f7a1c3e0-44bb-4c2a-9b23-1234567890ab",
  "planned_weight_kg": 88.50,
  "actual_weight_kg": 86.20,
  "actual_distance_km": 12.4,
  "actual_duration_min": 47,
  "hyperledger_tx_id": "0xabc123def456",
  "created_at": "2026-05-12T09:00:00Z",
  "state_history": [
    {
      "from_state": null,
      "to_state": "CREATED",
      "reason": null,
      "actor": "system",
      "transitioned_at": "2026-05-12T09:00:00Z"
    }
  ]
}
```

---

### 3.3 Collection Job Stats (F3 DB)

`GET /api/v1/collection-jobs/stats`

Aggregate metrics across completed jobs.

**Query Params** (all optional)

| Param | Example |
|---|---|
| `zone_id` | `1` |
| `date_from` | `2026-05-01T00:00:00Z` |
| `date_to` | `2026-05-12T23:59:59Z` |

**Response 200**
```json
{
  "total_jobs": 42,
  "emergency_jobs": 18,
  "routine_jobs": 24,
  "completed_jobs": 38,
  "escalated_jobs": 2,
  "cancelled_jobs": 2,
  "completion_rate_pct": 90.5,
  "avg_duration_minutes": 52.3,
  "avg_bins_per_job": 6.4,
  "avg_weight_per_job_kg": 285.40,
  "emergency_vs_routine_ratio": 0.75
}
```

---

### 3.4 Manually Trigger Collection Job (Demo / Testing)

`POST /api/v1/collection-jobs`

Manually creates and starts a collection job workflow. Used for testing and demo — in production jobs are triggered by Kafka `waste.bin.processed` events.

**Request Body**
```json
{
  "job_type": "emergency",
  "zone_id": "1",
  "waste_category": "general",
  "bin_ids": ["BIN-003", "BIN-004"],
  "urgency_score": 88
}
```

> All fields except `zone_id` are optional.  
> `job_type` defaults to `emergency`.  
> `urgency_score` defaults to `85`.  
> `waste_category` defaults to `general`.

**Response 201**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "CREATED"
}
```

---

### 3.5 Cancel Collection Job (Supervisor)

`POST /api/v1/collection-jobs/:id/cancel`

Cancels a job that has not yet reached `IN_PROGRESS`. Releases any assigned vehicle/driver.

**Request Body** (optional)
```json
{ "reason": "Zone temporarily inaccessible due to flooding" }
```

**Response 200**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "CANCELLED"
}
```

---

### 3.6 Public Complete (Backward Compat)

`POST /api/v1/collection-jobs/:id/complete`

Minimal-payload version — synthesises a completion request from the job's own data (marks all planned bins as collected). Use only for quick testing.

**No request body required.**

**Response 200**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "COMPLETED",
  "completed_at": "2026-05-12T10:52:34Z"
}
```

---

## 4. Error Format (all services)

All errors follow the same envelope:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP Status | Meaning |
|---|---|
| 400 | Validation error — missing or invalid field |
| 403 | Forbidden — wrong `X-Service-Name` header (production only) |
| 404 | Resource not found |
| 409 | Conflict — already processed, wrong state, or no vehicle |
| 500 | Internal server error |
| 503 | Upstream dependency unavailable (e.g. InfluxDB) |
