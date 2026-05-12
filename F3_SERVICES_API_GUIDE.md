# F3 Services API Guide

Internal APIs exposed by the **Scheduler**, **Bin-Status**, and **Orchestrator** services.  
All three services own F3 schema data (drivers, bin collection records, collection jobs, job state transitions).  
F2 schema data (vehicles, route plans, bins, clusters) is accessed exclusively through the Core API — never directly from these services.

---

## Service Connectivity

| Service | Local Port | K8s DNS |
|---|---|---|
| Scheduler | `http://localhost:3003` | `http://scheduler-base-service.waste-dev.svc.cluster.local:3003` |
| Bin-Status | `http://localhost:3002` | `http://bin-status-base-service.waste-dev.svc.cluster.local:3002` |
| Orchestrator | `http://localhost:3001` | `http://orchestrator-base-service.waste-dev.svc.cluster.local:3001` |

---

## 1. Scheduler Service

### 1.1 Internal — Dispatch Job

`POST /internal/scheduler/dispatch`

Called by the orchestrator when a collection job needs to be assigned. Finds an available vehicle from Core API, gets a driver from F3, calls route optimizer, persists the route plan to Core API, writes bin collection records to F3.

**Request Body**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "clusters": [
    {
      "cluster_id": "CLUSTER-001",
      "lat": 6.8831,
      "lng": 79.8612,
      "cluster_name": "Main Street Cluster"
    }
  ],
  "bins_to_collect": [
    {
      "bin_id": "BIN-001",
      "cluster_id": "CLUSTER-001",
      "lat": 6.8831,
      "lng": 79.8612,
      "waste_category": "general",
      "fill_level_pct": 92.0,
      "estimated_weight_kg": 45.0,
      "urgency_score": 88,
      "predicted_full_at": "2026-05-12T14:00:00Z"
    }
  ],
  "total_estimated_weight_kg": 45.0,
  "waste_category": "general",
  "zone_id": 1,
  "priority": 1
}
```

**Response 200**
```json
{
  "success": true,
  "vehicle_id": "LORRY-001",
  "driver_id": "DRV-001",
  "route_plan_id": "f7a1c3e0-44bb-4c2a-9b23-1234567890ab",
  "estimated_minutes": 45,
  "route": [
    {
      "cluster_id": "CLUSTER-001",
      "bins": ["BIN-001"],
      "estimated_arrival": "2026-05-12T09:15:00Z",
      "cumulative_weight_kg": 45.0
    }
  ]
}
```

**Response 409 — No vehicle available**
```json
{ "success": false, "reason": "NO_VEHICLE_AVAILABLE" }
```

**Response 500 — Vehicle has no driver in F3**
```json
{ "success": false, "reason": "VEHICLE_CONFIG_ERROR" }
```

---

### 1.2 Internal — Release Job

`POST /internal/scheduler/release`

Called by orchestrator on job completion or cancellation. Sets vehicle back to `available` in Core API and driver back to `available` in F3.

**Request Body**
```json
{ "job_id": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response 200**
```json
{ "released": true }
```

---

### 1.3 Internal — Complete Job

`POST /internal/jobs/:job_id/complete`

Updates in-memory job state to COMPLETED. The orchestrator's own `/internal/jobs/:id/complete` is the authoritative completion endpoint — this is a lightweight acknowledgement on the scheduler side.

**Response 200**
```json
{ "acknowledged": true }
```

---

### 1.4 Bin Collected (Driver App)

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

### 1.5 Skip Bin (Driver App)

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

### 1.6 Job Progress

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

### 1.7 Active Vehicles

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

### 1.8 Available Drivers (In-Memory)

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

### 1.9 List Drivers (F3 DB)

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

### 1.10 Get Single Driver (F3 DB)

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

### 1.11 Create Driver (F3 DB)

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

### 1.12 Update Driver (F3 DB)

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

### 2.1 Internal — Cluster Snapshot

`POST /internal/clusters/:cluster_id/snapshot`

Called by the orchestrator to confirm bin urgency before dispatching. Fetches authoritative state from Core API (F2) and overlays `has_active_job` from F3 (orchestrator DB) for each bin.

**Headers**
```
X-Service-Name: workflow-orchestrator
```

**No request body.**

**Response 200**
```json
{
  "cluster_id": "CLUSTER-001",
  "cluster_name": "Main Street Cluster",
  "zone_id": 1,
  "lat": 6.8831,
  "lng": 79.8612,
  "address": null,
  "total_bins": 4,
  "has_active_job": false,
  "active_job_id": null,
  "collectible_bins_count": 2,
  "collectible_bins_weight_kg": 88.50,
  "highest_urgency_score": 92,
  "highest_urgency_bin_id": "BIN-003",
  "bins": [
    {
      "bin_id": "BIN-001",
      "waste_category": "general",
      "fill_level_pct": 45.0,
      "status": "monitor",
      "urgency_score": 42,
      "estimated_weight_kg": 16.20,
      "volume_litres": 120,
      "avg_kg_per_litre": 0.3,
      "predicted_full_at": null,
      "fill_rate_pct_per_hour": 1.2,
      "should_collect": false
    },
    {
      "bin_id": "BIN-003",
      "waste_category": "general",
      "fill_level_pct": 93.5,
      "status": "critical",
      "urgency_score": 92,
      "estimated_weight_kg": 33.66,
      "volume_litres": 120,
      "avg_kg_per_litre": 0.3,
      "predicted_full_at": "2026-05-12T10:30:00Z",
      "fill_rate_pct_per_hour": 3.8,
      "should_collect": true
    }
  ]
}
```

**Response 404**
```json
{ "error": "CLUSTER_NOT_FOUND", "message": "Cluster CLUSTER-999 not found" }
```

**Response 403** (production only, wrong service header)
```json
{ "error": "FORBIDDEN", "message": "Invalid service name" }
```

---

### 2.2 Internal — Scan Nearby Clusters

`POST /internal/clusters/scan-nearby`

Called by the orchestrator during the wait-window cluster assembly phase. Returns all clusters within `radius_km` that have at least one bin meeting `min_urgency_score`.

**Headers**
```
X-Service-Name: workflow-orchestrator
```

**Request Body**
```json
{
  "lat": 6.8831,
  "lng": 79.8612,
  "radius_km": 2.0,
  "min_urgency_score": 80
}
```

**Response 200**
```json
{
  "clusters": [
    {
      "cluster_id": "CLUSTER-001",
      "cluster_name": "Main Street Cluster",
      "lat": 6.8831,
      "lng": 79.8612,
      "distance_km": 0.0,
      "highest_urgency_score": 92,
      "collectible_weight_kg": 88.50,
      "bins_to_collect": ["BIN-003", "BIN-004"]
    },
    {
      "cluster_id": "CLUSTER-005",
      "cluster_name": "Park Avenue",
      "lat": 6.8910,
      "lng": 79.8650,
      "distance_km": 1.243,
      "highest_urgency_score": 85,
      "collectible_weight_kg": 44.10,
      "bins_to_collect": ["BIN-022"]
    }
  ]
}
```

> Results are sorted by `highest_urgency_score` descending.

---

### 2.3 Internal — Mark Bin Collected

`POST /internal/bins/:bin_id/mark-collected`

Called by the orchestrator on job completion. Resets the bin's fill level to 0, urgency to 0, status to `normal` in the in-memory store. Propagates `last_collected_at` to Core API (F2) fire-and-forget. Publishes a `bin:update` dashboard event.

**Headers**
```
X-Service-Name: workflow-orchestrator
```

**Request Body**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "driver_id": "DRV-001",
  "collected_at": "2026-05-12T10:45:00Z",
  "fill_level_at_collection": 93.5,
  "actual_weight_kg": 43.2
}
```

> `fill_level_at_collection` and `actual_weight_kg` are optional.

**Response 200**
```json
{
  "success": true,
  "bin_id": "BIN-003",
  "collected_at": "2026-05-12T10:45:00Z"
}
```

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Bin BIN-999 not found" }
```

---

### 2.4 List Bins (Live State)

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

### 2.5 Get Single Bin

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

### 2.6 Bin Fill History

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

### 2.7 Cluster Detail

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

### 2.8 Zone Summary

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

### 2.9 List Zones

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
    },
    {
      "from_state": "DISPATCHED",
      "to_state": "DRIVER_NOTIFIED",
      "reason": null,
      "actor": "system",
      "transitioned_at": "2026-05-12T09:03:12Z"
    },
    {
      "from_state": "AUDIT_RECORDED",
      "to_state": "COMPLETED",
      "reason": null,
      "actor": "system",
      "transitioned_at": "2026-05-12T10:52:34Z"
    }
  ],
  "step_log": [
    {
      "step_name": "bin_confirmation",
      "attempt_number": 1,
      "success": true,
      "duration_ms": 312,
      "error_message": null,
      "executed_at": "2026-05-12T09:00:45Z"
    },
    {
      "step_name": "dispatch",
      "attempt_number": 1,
      "success": true,
      "duration_ms": 4821,
      "error_message": null,
      "executed_at": "2026-05-12T09:02:30Z"
    },
    {
      "step_name": "hyperledger-audit",
      "attempt_number": 1,
      "success": true,
      "duration_ms": 1234,
      "error_message": null,
      "executed_at": "2026-05-12T10:51:20Z"
    }
  ]
}
```

**Response 404**
```json
{
  "error": "RESOURCE_NOT_FOUND",
  "message": "Job 550e8400-e29b-41d4-a716-000000000000 not found",
  "timestamp": "2026-05-12T09:00:00Z"
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

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Job ... not found", "timestamp": "..." }
```

**Response 409 — Job is IN_PROGRESS**
```json
{
  "error": "CANNOT_CANCEL_IN_PROGRESS",
  "message": "Cannot cancel a job that is currently IN_PROGRESS — driver is already collecting"
}
```

**Response 409 — Other non-cancellable state**
```json
{
  "error": "INVALID_STATE",
  "message": "Cannot cancel job in state COMPLETED"
}
```

---

### 3.6 Internal — Complete Job

`POST /internal/jobs/:id/complete`

Called by the scheduler service when the driver has finished all collection stops. Runs the full completion workflow: marks bins collected in bin-status, writes execution metrics to F3, records Hyperledger audit, publishes Kafka `waste.collection.completed`, notifies dashboard.

**Request Body**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "vehicle_id": "LORRY-001",
  "driver_id": "DRV-001",
  "bins_collected": [
    {
      "bin_id": "BIN-003",
      "collected_at": "2026-05-12T10:15:00Z",
      "fill_level_at_collection": 93.5,
      "gps_lat": 6.8831,
      "gps_lng": 79.8612,
      "actual_weight_kg": 33.66
    }
  ],
  "bins_skipped": [
    {
      "bin_id": "BIN-004",
      "reason": "locked",
      "notes": "Compound gate locked"
    }
  ],
  "actual_weight_kg": 86.20,
  "actual_distance_km": 12.4,
  "route_gps_trail": []
}
```

**Response 200**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "COMPLETED",
  "completed_at": "2026-05-12T10:52:34Z"
}
```

**Response 409**
```json
{ "error": "INVALID_STATE", "message": "Cannot complete job in state DISPATCHED" }
```

---

### 3.7 Public Complete (Backward Compat)

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
