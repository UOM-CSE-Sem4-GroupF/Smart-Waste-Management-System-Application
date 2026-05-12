# F3 Driver API Guide

All driver endpoints are served by the **Scheduler Service** and exposed through the deployed
Kong gateway. The Kong `drivers-api` route matches `/api/v1/drivers` with methods
`GET`, `POST`, `PUT`, `PATCH`.

**Base URL (Kubernetes):** `http://<kong-ingress>/api/v1/drivers`

---

## Endpoints

### GET /api/v1/drivers
List all drivers from the F3 database.

**Query parameters**

| Param    | Type   | Default | Description                        |
|----------|--------|---------|------------------------------------|
| zone_id  | number | —       | Filter by zone                     |
| limit    | number | 50      | Max records returned (max 200)     |
| offset   | number | 0       | Pagination offset                  |

**Response 200**
```json
{
  "data": [
    {
      "driver_id":    "DRV-001",
      "name":         "Amal Perera",
      "vehicle_id":   "LORRY-01",
      "vehicle_type": "large_truck",
      "zone_id":      1,
      "status":       "available"
    }
  ],
  "total": 5
}
```

**Status values:** `available` | `on_job` | `off_duty`

---

### GET /api/v1/drivers/available
List only drivers currently available for dispatch (reads from in-memory store, used by the
dispatch flow). Returns the same shape as the list endpoint but without pagination.

**Response 200**
```json
{
  "drivers": [
    {
      "driver_id":    "DRV-001",
      "driver_name":  "Amal Perera",
      "vehicle_id":   "LORRY-01",
      "vehicle_type": "large_truck",
      "zone_id":      1,
      "status":       "available"
    }
  ]
}
```

---

### GET /api/v1/drivers/:id
Get a single driver by ID.

**Response 200** — same shape as a single item from the list.

**Response 404**
```json
{ "error": "RESOURCE_NOT_FOUND", "message": "Driver DRV-999 not found" }
```

---

### POST /api/v1/drivers
Create a new driver.

**Request body**
```json
{
  "driver_id":  "DRV-010",
  "name":       "Nuwan Silva",
  "zone_id":    2,
  "vehicle_id": "LORRY-06"
}
```

| Field      | Required | Description                              |
|------------|----------|------------------------------------------|
| driver_id  | yes      | Unique ID, e.g. `DRV-010`               |
| name       | yes      | Full name                                |
| zone_id    | no       | Assigned zone (defaults to 0)            |
| vehicle_id | no       | Assigned vehicle ID (`current_vehicle_id`)|

**Response 201** — driver object (same shape as GET).

**Response 400** — missing `driver_id` or `name`.

**Response 409** — `driver_id` already exists.

---

### PATCH /api/v1/drivers/:id
Update one or more fields on an existing driver.

**Request body** — any subset of:
```json
{
  "name":       "Updated Name",
  "zone_id":    3,
  "vehicle_id": "LORRY-07",
  "status":     "off_duty"
}
```

Unknown fields (e.g. `active`) are silently ignored — safe to send without errors.

**Response 200** — updated driver object.

**Response 404** — driver not found.

---

## Field reference

| Response field | DB column            | Notes                                        |
|----------------|----------------------|----------------------------------------------|
| `driver_id`    | `f3.drivers.id`      | VARCHAR(20) PK                               |
| `name`         | `f3.drivers.name`    | VARCHAR(100)                                 |
| `vehicle_id`   | `f3.drivers.current_vehicle_id` | nullable                        |
| `vehicle_type` | derived              | From vehicle ID prefix — not stored in DB    |
| `zone_id`      | `f3.drivers.zone_id` | INT                                          |
| `status`       | `f3.drivers.status`  | `available` / `on_job` / `off_duty`          |

**Not yet implemented** (pending Keycloak integration): `email`, `phone`, `license_no`.
