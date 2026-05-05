# Smart Waste Management System — Project Details

**Internal Name:** Garabadge  
**Type:** Microservices web application  
**Purpose:** Real-time operations dashboard for managing urban waste collection — tracking bin fill levels, dispatching collection jobs, assigning drivers and vehicles, and streaming live telemetry to supervisors.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Services](#services)
   - [Orchestrator (3001)](#orchestrator-service-port-3001)
   - [Bin Status (3002)](#bin-status-service-port-3002)
   - [Scheduler (3003)](#scheduler-service-port-3003)
   - [Notification (3004)](#notification-service-port-3004)
   - [Telemetry Bridge (Python)](#telemetry-bridge-python)
   - [Frontend / Dashboard (3000)](#frontend--dashboard-port-3000)
   - [Kong API Gateway (8000/8001)](#kong-api-gateway-ports-80008001)
4. [Communication Patterns](#communication-patterns)
5. [Kafka Topics](#kafka-topics)
6. [Orchestrator State Machine](#orchestrator-state-machine)
7. [Data Models](#data-models)
8. [Kong Routes & Plugins](#kong-routes--plugins)
9. [Frontend Architecture](#frontend-architecture)
10. [Key Constants & Thresholds](#key-constants--thresholds)
11. [Tech Stack](#tech-stack)
12. [Environment Variables](#environment-variables)
13. [Running the System](#running-the-system)

---

## Architecture Overview

```
                        ┌─────────────────────┐
                        │   IoT Bin Sensors   │
                        └────────┬────────────┘
                                 │ waste.bin.telemetry (Kafka)
                        ┌────────▼────────────┐
                        │  Telemetry Bridge   │  (Python)
                        │  (Kafka → HTTP)     │
                        └────┬──────────┬─────┘
                             │          │ POST /internal/bins/ingest
                             │          ▼
                             │  ┌──────────────────┐
                             │  │  Bin Status Svc  │ :3002
                             │  │  (fill levels,   │
                             │  │   urgency, zones) │
                             │  └──────┬───────────┘
                             │         │ waste.bin.processed (Kafka)
                             │         ▼
                             │  ┌──────────────────┐
                             │  │  Orchestrator    │ :3001
                             │  │  (state machine, │
                             │  │   job lifecycle)  │
                             │  └──┬────┬──────────┘
                             │     │    │ /internal/scheduler/dispatch
                             │     │    ▼
                             │     │  ┌──────────────────┐
                             │     │  │  Scheduler Svc   │ :3003
                             │     │  │  (drivers, veh-  │
                             │     │  │   icles, routes)  │
                             │     │  └──────────────────┘
                             │     │ /internal/notify/*
                             │     ▼
                             │  ┌──────────────────┐
                             │  │  Notification    │ :3004
                             │  │  (Socket.IO hub, │
                             │  │   FCM push notif) │
                             │  └──────────────────┘
                             │           ▲
                             │           │ WebSocket
                        ┌────▼───────────┴────┐
                        │   Kong API Gateway  │ :8000
                        │   (routing, CORS,   │
                        │    rate limiting)   │
                        └─────────┬───────────┘
                                  │ HTTP / WebSocket
                        ┌─────────▼───────────┐
                        │  Next.js Dashboard  │ :3000
                        │  (ops dashboard,    │
                        │   Leaflet map,      │
                        │   real-time views)  │
                        └─────────────────────┘
```

All backend services are **TypeScript + Fastify**. State is held entirely in **in-memory Maps** — there is no database; data is lost on restart.

---

## Directory Structure

```
Smart-Waste-Management-System-Application/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Entry — renders <Dashboard />
│   ├── dashboard.tsx           # Main single-page dashboard (client component)
│   ├── layout.tsx              # Root HTML layout
│   └── globals.css             # Global Tailwind styles
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx          # Alert count, connection status indicator
│   │   └── Sidebar.tsx         # View navigation
│   ├── views/
│   │   ├── MapView.tsx         # Leaflet map — bins + vehicles
│   │   ├── BinsView.tsx        # Bin table with fill levels
│   │   ├── JobsView.tsx        # Job list with states
│   │   ├── AlertsView.tsx      # Alert timeline
│   │   ├── AnalyticsView.tsx   # Charts
│   │   ├── HistoryView.tsx     # Historical readings
│   │   └── RoutesView.tsx      # Active collection routes
│   └── ui/
│       ├── FillBar.tsx         # Visual fill-level bar
│       ├── StatusChip.tsx      # Urgency status badge
│       └── PulseDot.tsx        # Live data indicator
├── lib/
│   └── types.ts                # Shared frontend TypeScript types
├── backend/
│   ├── orchestrator/           # Port 3001 — collection job state machine
│   ├── bin-status/             # Port 3002 — bin fill levels, urgency, zones
│   ├── scheduler/              # Port 3003 — vehicles, drivers, route planning
│   └── notification/           # Port 3004 — Socket.IO hub + FCM push
├── telemetry-bridge/           # Python: Kafka → HTTP bridge for IoT telemetry
├── kong/
│   └── kong.yml                # Declarative Kong config (DB-less mode)
├── simulator/                  # Test/simulation utilities
├── tests/                      # Test suite
├── docker-compose.yml          # Full stack orchestration
├── Dockerfile                  # Next.js frontend image
├── next.config.ts
└── tsconfig.json
```

---

## Services

### Orchestrator Service (Port 3001)

**Responsibility:** Owns the lifecycle of every collection job through a 23-state state machine. Consumes Kafka events, calls other services internally, and transitions jobs from creation through completion or escalation.

**Framework:** Fastify + TypeScript + KafkaJS

#### Public API Routes (via Kong)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/collection-jobs` | List jobs — filters: `job_type`, `state`, `zone_id`, `date_from`, `date_to`; pagination |
| GET | `/api/v1/collection-jobs/stats` | Job statistics |
| GET | `/api/v1/collection-jobs/:job_id` | Job detail (404 if not found) |
| POST | `/api/v1/collection-jobs/:job_id/cancel` | Cancel job (409 if in invalid state) |

#### Internal Routes (cluster-only, not exposed through Kong)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/jobs/:job_id/complete` | Completion callback from scheduler |

#### Workflow Logic

**Emergency workflow** (triggered when `urgency_score >= 80` on `waste.bin.processed`):
1. Deduplication: ignores duplicate bin events within a 5-minute window
2. Confirm urgency with bin-status service (`/internal/bins/:id/confirm-urgency`)
3. Assemble cluster (collect additional urgent bins in zone within urgency window)
4. Dispatch to scheduler (`/internal/scheduler/dispatch`) with priority:
   - `urgency_score >= 90` → priority 1
   - `urgency_score >= 80` → priority 2
   - else → priority 3
5. Up to 3 dispatch retries with 2-second delays between attempts
6. If no vehicle available → escalate to `ESCALATED` state, notify dashboard

**Routine workflow** (triggered by `waste.routine.schedule.trigger` Kafka event):
- Lower priority (3), pre-assembled clusters from scheduler

---

### Bin Status Service (Port 3002)

**Responsibility:** Ingests IoT bin telemetry, maintains current fill levels and urgency scores, stores a 50-reading circular history buffer per bin, and provides zone summaries. Also runs a Socket.IO server for direct real-time bin updates to the frontend.

**Framework:** Fastify + TypeScript + KafkaJS + Socket.IO

#### Seed Data

9 bins pre-seeded across 3 zones (Zone-1, Zone-2, Zone-3) with various fill levels and waste categories.

#### Public API Routes (via Kong)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/bins` | List bins — filters: `zone_id`, `status`; pagination: `page`, `limit` |
| GET | `/api/v1/bins/:id` | Bin detail |
| GET | `/api/v1/bins/:id/history` | Last 50 readings (FIFO circular buffer) |
| GET | `/api/v1/zones` | Zone list with `bin_count`, `avg_fill_pct`, `urgent_bins`, `total_weight_kg` |
| GET | `/api/v1/zones/:id/summary` | Detailed zone stats broken down by urgency status |

#### Internal Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/bins/ingest` | Telemetry ingestion from telemetry-bridge |
| POST | `/internal/bins/:id/confirm-urgency` | Check if bin still has `urgency_score >= 80` (called by orchestrator) |
| POST | `/internal/bins/:id/mark-collected` | Reset fill level after collection (called by orchestrator) |

#### Urgency Status Mapping

| Fill Level | Status |
|-----------|--------|
| `>= 90%` | `critical` |
| `>= 75%` | `urgent` |
| `>= 50%` | `monitor` |
| `< 50%` | `normal` |

#### Weight Density Constants (kg per litre)

| Category | kg/L |
|----------|------|
| `food_waste` | 0.90 |
| `paper` | 0.10 |
| `glass` | 2.50 |
| `plastic` | 0.05 |
| `general` | 0.30 |
| `e_waste` | 3.20 |

#### Socket.IO

- Server on `/socket.io` path
- Clients join room `dashboard-all` to receive `bin:update` events
- Transports: WebSocket + HTTP long-polling
- Ping interval: 10s, timeout: 20s

---

### Scheduler Service (Port 3003)

**Responsibility:** Manages vehicle and driver assignment, generates optimized collection routes using OR-Tools (with nearest-neighbour fallback), tracks in-progress bin collections, and releases resources when jobs complete.

**Framework:** Fastify + TypeScript + KafkaJS

#### Seed Data

**Drivers:**

| ID | Name | Zone | Shift |
|----|------|------|-------|
| DRV-001 | Amal Perera | Zone-1 | 06:00–14:00 |
| DRV-002 | Nimal Silva | Zone-2 | 06:00–14:00 |
| DRV-003 | Kamal Fernando | Zone-3 | 14:00–22:00 |
| DRV-004 | Sunil Jayawardena | Zone-1 | 14:00–22:00 |
| DRV-005 | Roshan Bandara | Zone-2 | 22:00–06:00 |

**Vehicles:**

| ID | Max Cargo | Supported Categories |
|----|-----------|---------------------|
| LORRY-01 | 5,000 kg | general, paper, plastic |
| LORRY-02 | 8,000 kg | glass, e_waste |
| LORRY-03 | 4,000 kg | food_waste, general |
| LORRY-04 | 6,000 kg | general, food_waste, paper |

#### Assignment Logic

**Driver selection:**
1. Prefer driver assigned to target zone
2. Fallback to any available driver

**Vehicle selection:**
1. Find smallest sufficient vehicle that is available, supports waste category, and has `max_cargo_kg >= planned_weight_kg`
2. Fallback to any available vehicle supporting the waste category

#### Route Optimization

- Primary: OR-Tools VRP solver (35-second timeout), respects time windows (urgency score per bin), cargo limits, and waste category compatibility
- Fallback: nearest-neighbour greedy algorithm using haversine distance

#### Public API Routes (via Kong)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vehicles` | All vehicles |
| GET | `/api/v1/vehicles/active` | Assigned vehicles with job progress |
| GET | `/api/v1/vehicles/:id` | Vehicle detail |
| GET | `/api/v1/drivers` | All drivers |
| GET | `/api/v1/drivers/available` | Unassigned drivers |
| GET | `/api/v1/drivers/:id` | Driver detail |
| GET | `/api/v1/jobs/:job_id/progress` | Progress summary: bins collected/skipped/pending, cargo utilisation |
| POST | `/api/v1/collections/:job_id/bins/:bin_id/collected` | Mark bin collected (fill_level, gps, weight, notes, photo_url) |
| POST | `/api/v1/collections/:job_id/bins/:bin_id/skip` | Skip bin (reason, notes) |

#### Internal Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/scheduler/dispatch` | Accept dispatch request, return vehicle + driver + route_plan_id |
| POST | `/internal/scheduler/release` | Release job resources (free driver and vehicle) |

#### Kafka Consumers

| Topic | Action |
|-------|--------|
| `waste.vehicle.location` | Update vehicle lat/lng/heading/speed |
| `waste.vehicle.deviation` | Detect off-route alerts |

#### Cargo Thresholds

| Threshold | Trigger |
|-----------|---------|
| 90% of `max_cargo_kg` | Emit weight-limit alert via notification service |
| 100% of `max_cargo_kg` | Vehicle full — trigger job completion |

---

### Notification Service (Port 3004)

**Responsibility:** Central real-time notification hub. Serves Socket.IO connections to the frontend, receives internal HTTP calls from other services, and optionally sends Firebase Cloud Messaging (FCM) push notifications to offline drivers.

**Framework:** Fastify + TypeScript + Socket.IO + firebase-admin + Redis (optional)

#### Socket.IO Room Assignment (by role)

| Role | Rooms Joined |
|------|-------------|
| `supervisor` | `dashboard-all`, `dashboard-zone-{zoneId}`, `alerts-all` |
| `fleet-operator` | `dashboard-all`, `fleet-ops`, `alerts-all` |
| `driver` | `driver-{driverId}` |
| default | `dashboard-all` |

#### Events Emitted

| Event | Rooms | Trigger |
|-------|-------|---------|
| `job:assigned` | `driver-{driver_id}` | Job dispatched to driver (+ FCM if disconnected) |
| `job:created` | `dashboard-zone-{zone_id}`, `dashboard-all`, `fleet-ops` | New job created |
| `job:completed` | `dashboard-zone-{zone_id}`, `dashboard-all`, `fleet-ops`, `driver-{driver_id}` | Job finished |
| `job:cancelled` | `dashboard-zone-{zone_id}`, `dashboard-all`, `driver-{driver_id}` | Job cancelled |
| `job:progress` | `dashboard-zone-{zone_id}`, `dashboard-all` | Progress update (from Kafka) |
| `vehicle:position` | `dashboard-zone-{zone_id}`, `dashboard-all`, `fleet-ops` | GPS update (from Kafka) |
| `alert:urgent` | `dashboard-zone-{zone_id}`, `dashboard-all`, `alerts-all` | Bin urgency alert (from Kafka) |
| `alert:escalated` | `dashboard-zone-{zone_id}`, `dashboard-all`, `alerts-all` | No vehicle available |
| `alert:deviation` | `dashboard-zone-{zone_id}`, `alerts-all`, `fleet-ops` | Vehicle off-route |
| `alert:weight-limit` | `dashboard-all`, `fleet-ops` | Cargo >= 90% capacity |

#### Internal API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/notify/job-assigned` | Notify driver of assignment |
| POST | `/internal/notify/job-created` | Broadcast new job |
| POST | `/internal/notify/job-completed` | Broadcast completion |
| POST | `/internal/notify/job-escalated` | Broadcast escalation |
| POST | `/internal/notify/job-cancelled` | Broadcast cancellation |
| POST | `/internal/notify/vehicle-position` | Broadcast vehicle location |
| POST | `/internal/notify/alert-deviation` | Broadcast deviation alert |

#### Kafka Consumers

| Topic | Consumer Group | Events Handled |
|-------|---------------|----------------|
| `waste.bin.dashboard.updates` | `notification-bin-updates` | `bin:update`, `zone:stats`, `alert:urgent` |
| `waste.vehicle.dashboard.updates` | `notification-vehicle-updates` | `vehicle:position`, `job:progress` |

#### Scaling

- Optional Redis adapter (`@socket.io/redis-adapter`) enables multi-pod horizontal scaling via pub/sub
- Gracefully degrades to single-pod mode when Redis is unavailable

---

### Telemetry Bridge (Python)

**Responsibility:** Consumes IoT bin telemetry events from Kafka and forwards them over HTTP to the bin-status and notification services.

**Language:** Python 3  
**Libraries:** `kafka-python`, `requests`

#### Kafka Consumer

- Topic: `waste.bin.telemetry`
- Partition 0 (direct assignment, avoids KRaft controller issues)
- No consumer group (stateless, seeks to end on startup)
- Auth: optional SASL_PLAINTEXT with SCRAM-SHA-256

#### HTTP Calls Made

```
POST {BIN_STATUS_URL}/internal/bins/ingest
POST {NOTIFICATION_URL}/internal/notify/bin-update
```

- 2-second timeout per request; failures logged as warnings (no retry)
- Consumer reconnects after 5-second backoff on error

#### Payload

Supports two formats:
- Envelope: `{ "payload": { ... }, "timestamp": "..." }`
- Flat: `{ bin_id, fill_level_pct, ... }` (timestamp added automatically)

---

### Frontend / Dashboard (Port 3000)

**Framework:** Next.js 16.2.4 + React 19.2.4 + TypeScript  
**UI:** Tailwind CSS v4  
**Map:** Leaflet 1.9.4

#### Views

| View ID | Component | Shows |
|---------|-----------|-------|
| `map` | MapView | Interactive Leaflet map with bin markers and vehicle positions |
| `bins` | BinsView | Bin table with fill levels, urgency status, zone |
| `jobs` | JobsView | Job list with current state, type, zone, progress |
| `alerts` | AlertsView | Alert timeline with acknowledge actions |
| `analytics` | AnalyticsView | Charts and statistics |
| `history` | HistoryView | Historical bin readings |

#### Data Loading

**REST polling** every 10 seconds via Kong (`:8000`):
- `GET /api/v1/bins`
- `GET /api/v1/collection-jobs`
- `GET /api/v1/zones`
- `GET /api/v1/vehicles/active`

**Socket.IO connections** for real-time updates:
1. **Bin Status service** (`:3002`) — joins `dashboard-all` — receives `bin:update`
2. **Notification service** (`:8000/socket.io`) — joins `dashboard-all`, `fleet-ops` — receives `job:created`, `job:progress`, `job:completed`, `job:cancelled`, `vehicle:position`, `alert:urgent`, `alert:deviation`, `alert:escalated`

#### Data Adapters (dashboard.tsx)

Adapter functions translate backend response shapes into frontend types:
- `adaptBins()` → `Bin[]`
- `adaptZones()` → `Zone[]`
- `adaptVehicles()` → `Vehicle[]`
- `adaptRoutes()` → `Route[]`
- `adaptJobs()` → `Job[]`

#### Connection Status

| Status | Meaning |
|--------|---------|
| `connecting` | Initial connection attempt |
| `live` | Data successfully received |
| `error` | API unreachable |

---

### Kong API Gateway (Ports 8000/8001)

**Mode:** DB-less declarative config (`kong/kong.yml`)

**Ports:**
- `8000` — Proxy (public traffic)
- `8001` — Admin API

**Plugins applied globally:**

| Plugin | Configuration |
|--------|--------------|
| CORS | `origins: ["*"]`, methods: GET/POST/OPTIONS, max_age: 3600 |
| Rate Limiting | 300 requests/minute per IP, local policy |

**Notification service** has a 24-hour read timeout (`86400000ms`) to support long-lived WebSocket/SSE connections.

---

## Communication Patterns

| Pattern | Used For |
|---------|----------|
| **Kafka (async)** | Bin telemetry ingest, emergency triggers, routine schedule triggers, vehicle GPS, job completion events |
| **HTTP (sync)** | Orchestrator calling bin-status, scheduler, notification for internal operations |
| **Socket.IO (WebSocket)** | Pushing real-time events to the frontend dashboard |
| **Kong (HTTP proxy)** | Routing all public traffic; internal `/internal/*` routes are cluster-only and never exposed |

---

## Kafka Topics

| Topic | Producer | Consumer(s) | Purpose |
|-------|----------|-------------|---------|
| `waste.bin.telemetry` | IoT sensors | telemetry-bridge | Raw bin sensor readings |
| `waste.bin.processed` | bin-status | orchestrator (emergency), bin-status (self) | Processed bin state after ingest |
| `waste.routine.schedule.trigger` | external scheduler | orchestrator (routine) | Trigger routine collection runs |
| `waste.bin.dashboard.updates` | bin-status | notification | Bin updates for dashboard broadcasting |
| `waste.vehicle.location` | vehicle GPS | scheduler | Vehicle real-time position |
| `waste.vehicle.dashboard.updates` | scheduler | notification | Vehicle/job updates for dashboard |
| `waste.vehicle.deviation` | scheduler | scheduler | Off-route detection |
| `waste.driver.responses` | driver app | orchestrator | Driver accept/reject responses |
| `waste.job.completed` | orchestrator | (downstream consumers) | Job completion event |

---

## Orchestrator State Machine

States are ordered, append-only (state history is never mutated — it forms an audit trail).

```
CREATED
  └─► BIN_CONFIRMING
        └─► BIN_CONFIRMED
              └─► CLUSTER_ASSEMBLING
                    └─► CLUSTER_ASSEMBLED
                          └─► DISPATCHING
                                ├─► DISPATCHED
                                │     └─► DRIVER_NOTIFIED
                                │           └─► IN_PROGRESS
                                │                 └─► COMPLETING
                                │                       └─► COLLECTION_DONE
                                │                             └─► RECORDING_AUDIT
                                │                                   ├─► AUDIT_RECORDED ─► COMPLETED
                                │                                   └─► AUDIT_FAILED   ─► COMPLETED
                                └─► (no vehicle after 3 retries) ESCALATED
                    └─► SPLIT_JOB ─► DISPATCHING (restart from dispatch)

  ─► CANCELLED  (from any state before IN_PROGRESS)
  ─► FAILED     (on unrecoverable error)
```

**Cancellable states:** CREATED, BIN_CONFIRMING, BIN_CONFIRMED, CLUSTER_ASSEMBLING, CLUSTER_ASSEMBLED, DISPATCHING, DISPATCHED, DRIVER_NOTIFIED

**Terminal states:** COMPLETED, FAILED, ESCALATED, CANCELLED

**Max dispatch retries:** 3 (2-second delay between attempts)

---

## Data Models

### BinState (bin-status store)

```typescript
{
  bin_id: string
  fill_level_pct: number          // 0–100
  urgency_score: number           // 0–100 (mirrors fill_level_pct)
  urgency_status: 'normal' | 'monitor' | 'urgent' | 'critical'
  collection_status: 'available' | 'pending_collection' | 'collecting' | 'collected'
  estimated_weight_kg: number     // fill_level_pct × volume_litres × density
  waste_category: 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste'
  volume_litres: number
  zone_id: string
  lat: number
  lng: number
  battery_pct: number
  last_reading_at: string         // ISO 8601
  last_collected_at?: string
}
```

### Frontend Job States (lib/types.ts)

```typescript
type JobState =
  | 'CREATED' | 'BIN_CONFIRMING' | 'BIN_CONFIRMED'
  | 'CLUSTER_ASSEMBLING' | 'CLUSTER_ASSEMBLED'
  | 'DISPATCHING' | 'DISPATCHED'
  | 'DRIVER_NOTIFIED' | 'DRIVER_ACCEPTED'
  | 'IN_PROGRESS' | 'COMPLETING' | 'COLLECTION_DONE'
  | 'COMPLETED' | 'ESCALATED' | 'FAILED' | 'CANCELLED'

type BinStatus = 'ok' | 'warning' | 'critical' | 'offline'
type WasteType = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste'
type JobType = 'routine' | 'emergency'
type AlertType = 'urgent' | 'deviation' | 'escalated'
type ViewId = 'map' | 'bins' | 'jobs' | 'alerts' | 'analytics' | 'history'
```

---

## Kong Routes & Plugins

### Routes

| Service | Path | Methods |
|---------|------|---------|
| Orchestrator `:3001` | `/api/v1/collection-jobs` | GET, POST |
| | `/api/v1/collection-jobs/{id}` | GET |
| | `/api/v1/collection-jobs/{id}/accept` | POST |
| | `/api/v1/collection-jobs/{id}/cancel` | POST |
| | `/api/v1/collection-jobs/{id}/complete` | POST |
| | `/api/v1/orchestrator/health` | GET |
| Bin Status `:3002` | `/api/v1/bins` | GET |
| | `/api/v1/bins/{id}` | GET |
| | `/api/v1/bins/{id}/history` | GET |
| | `/api/v1/zones` | GET |
| | `/api/v1/zones/{id}/summary` | GET |
| Scheduler `:3003` | `/api/v1/vehicles` | GET |
| | `/api/v1/vehicles/active` | GET |
| | `/api/v1/vehicles/{id}` | GET |
| | `/api/v1/drivers` | GET |
| | `/api/v1/drivers/available` | GET |
| | `/api/v1/drivers/{id}` | GET |
| | `/api/v1/collections/{job_id}/bins/{bin_id}/collected` | POST |
| | `/api/v1/collections/{job_id}/bins/{bin_id}/skip` | POST |
| | `/api/v1/jobs/{job_id}/progress` | GET |
| Notification `:3004` | `/ws`, `/socket.io` | GET, POST |
| Next.js `:3000` | `/` (all paths) | — |

---

## Frontend Architecture

```
app/page.tsx
  └── app/dashboard.tsx              ← single client component, owns all state
        ├── useEffect: Socket.IO setup (bin-status + notification)
        ├── useEffect: REST polling (10s interval)
        ├── adaptBins / adaptZones / adaptVehicles / adaptRoutes / adaptJobs
        ├── components/layout/TopBar   (alert count, connection status)
        ├── components/layout/Sidebar  (view switcher)
        └── components/views/
              ├── MapView              (Leaflet map)
              ├── BinsView             (bin table)
              ├── JobsView             (job list)
              ├── AlertsView           (alert timeline)
              ├── AnalyticsView        (charts)
              ├── HistoryView          (history)
              └── RoutesView           (active routes)
```

State management is plain `useState` and `useRef` — no external state library.

---

## Key Constants & Thresholds

| Constant | Value | Location |
|----------|-------|----------|
| Emergency urgency threshold | `>= 80` | orchestrator Kafka consumer |
| Priority 1 | `>= 90` urgency score | orchestrator dispatch |
| Priority 2 | `>= 80` urgency score | orchestrator dispatch |
| Priority 3 | `< 80` (routine) | orchestrator dispatch |
| Critical fill level | `>= 90%` | bin-status urgency mapping |
| Urgent fill level | `>= 75%` | bin-status urgency mapping |
| Monitor fill level | `>= 50%` | bin-status urgency mapping |
| Emergency dedup window | 5 minutes | orchestrator Kafka consumer |
| Dispatch retries | 3 (2s delay) | orchestrator |
| OR-Tools VRP timeout | 35 seconds | scheduler route optimizer |
| Cargo warning | 90% of max_cargo_kg | scheduler collection handler |
| Vehicle full trigger | 100% of max_cargo_kg | scheduler collection handler |
| Bin history retention | 50 readings | bin-status FIFO buffer |
| Socket.IO ping interval | 10 seconds | bin-status, notification |
| Socket.IO ping timeout | 20 seconds | bin-status, notification |
| Frontend poll interval | 10 seconds | dashboard.tsx |
| Kong rate limit | 300 req/min per IP | kong.yml |
| Kong WS read timeout | 24 hours (86400000ms) | notification service route |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 16.2.4 |
| | React | 19.2.4 |
| | TypeScript | 5.9.3 |
| | Socket.IO Client | 4.8.3 |
| | Leaflet | 1.9.4 |
| | Tailwind CSS | 4 |
| Backend (all services) | Fastify | 4.27.0 |
| | TypeScript | 5.4.5 |
| | KafkaJS | 2.2.4 |
| | Socket.IO Server | 4.8.3 (bin-status, notification) |
| | Firebase Admin SDK | 13.4.0 (notification only) |
| | Redis client | 4.7.0 (notification optional) |
| | @socket.io/redis-adapter | 8.3.0 (notification optional) |
| Telemetry | Python | 3 |
| | kafka-python | latest |
| | requests | latest |
| API Gateway | Kong | 3.7 (DB-less) |
| Testing | Vitest | 2.1.9 |
| Container | Docker Compose | — |

---

## Environment Variables

### Shared (all backend services via docker-compose anchor)

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BROKER` / `KAFKA_BROKERS` | `localhost:9092` | Kafka broker address |
| `KAFKA_USER` | — | SASL username (optional) |
| `KAFKA_PASS` | — | SASL password (optional) |

### Per-Service

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `PORT` | all backend | 3001–3004 | HTTP listen port |
| `BIN_STATUS_URL` | orchestrator | `http://bin-status:3002` | Bin status service base URL |
| `SCHEDULER_URL` | orchestrator | `http://scheduler:3003` | Scheduler service base URL |
| `NOTIFICATION_URL` | orchestrator, telemetry | `http://notification:3004` | Notification service base URL |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `http://localhost:8000` | Kong gateway URL (dev: direct service) |
| `BIN_STATUS_URL` | telemetry-bridge | `http://bin-status:3002` | Target for telemetry HTTP forward |
| `KAFKA_TOPIC` | telemetry-bridge | `waste.bin.telemetry` | Telemetry Kafka topic to consume |

---

## Running the System

### Full stack (Docker)

```bash
docker compose up --build   # Build images and start all services
docker compose up           # Start with cached images
docker compose down         # Stop and remove containers
```

### Individual services (dev)

```bash
# Frontend (Next.js)
npm run dev         # :3000

# Each backend service (run inside backend/<service>/)
npm run dev         # ts-node-dev with hot reload
npm run build       # tsc → dist/
npm run start       # node dist/index.js
npm run test        # vitest (single pass)

# Telemetry bridge
cd telemetry-bridge && pip install -r requirements.txt
python bridge.py
```

### Health checks

All services expose `GET /health` — Docker Compose uses `wget /health` for readiness before dependent services start.

### API surface (dev vs Docker)

| Mode | API Base URL | Description |
|------|-------------|-------------|
| Dev | `http://localhost:3001` (direct) | Hit Fastify services directly |
| Docker/prod | `http://localhost:8000` (Kong) | All traffic via gateway |
