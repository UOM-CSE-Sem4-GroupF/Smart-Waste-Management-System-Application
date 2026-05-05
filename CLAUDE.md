# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (Next.js, root)
```bash
npm run dev       # Start dev server on :3000
npm run build     # Production build
npm run lint      # ESLint
```

### Backend services (run inside each `backend/<service>/` directory)
```bash
npm run dev       # ts-node-dev with hot reload
npm run build     # tsc → dist/
npm run start     # node dist/index.js
npm run test      # vitest run (single pass)
npm run test:watch
```

### Full stack
```bash
docker compose up --build   # Build and start everything
docker compose up           # Start with cached images
docker compose down
```

### Python telemetry bridge
```bash
cd telemetry-bridge && pip install -r requirements.txt
python bridge.py
```

## Architecture

The system is called "Garabadge" internally. It is a microservices application for managing waste collection operations.

### Services

| Service | Port | Responsibility |
|---------|------|---------------|
| `backend/orchestrator` | 3001 | Collection job state machine, Kafka consumer |
| `backend/bin-status` | 3002 | Bin fill levels, urgency scoring, zone data |
| `backend/scheduler` | 3003 | Vehicle/driver assignment and release |
| `backend/notification` | 3004 | Socket.IO WebSocket hub, internal notify API |
| `telemetry-bridge` | — | Python Kafka consumer → HTTP bridge |
| Next.js (root) | 3000 | Operations dashboard frontend |
| Kong | 8000/8001 | API Gateway (declarative config in `kong/kong.yml`) |

### Communication

- **Kafka** (async): `waste.bin.processed`, `waste.routine.schedule.trigger`, `waste.driver.responses`, `waste.bin.telemetry`
- **HTTP** (sync): orchestrator calls bin-status, scheduler, and notification via their `/internal/...` routes; telemetry bridge POSTs to bin-status and notification
- **WebSocket**: Socket.IO on the notification service; frontend subscribes for live updates. Clients join named rooms (`dashboard-all`, `fleet-ops`).
- **Kong** routes public traffic (`/api/v1/*`, `/ws`, `/socket.io`, `/`) to the appropriate service. Internal routes (`/internal/*`) are cluster-only — never exposed through Kong.

### Orchestrator state machine

`backend/orchestrator/src/state-machine/machine.ts` implements a 23-state job lifecycle (`CREATED` → `COMPLETED` / `FAILED` / `ESCALATED`). Key points:
- Max 3 driver reassignment retries before job escalates.
- Job type is either `emergency` (triggered by bin urgency > 80) or `routine` (triggered by scheduled Kafka event).
- State history and step results are appended but never mutated, providing an audit trail.

### Storage

All services use **in-memory Maps** — there is no database. State is ephemeral and lost on restart. The store modules (`backend/*/src/store.ts`) are the single source of truth per service.

### Frontend data flow

`app/page.tsx` → `app/dashboard.tsx` is the entry point. The dashboard uses `socket.io-client` to receive live events from the notification service and renders views in `components/` (BinsView, RoutesView, AlertsView, MapView via Leaflet, AnalyticsView).

The API base URL is configured via `NEXT_PUBLIC_API_BASE_URL`:
- Dev: direct Fastify service (e.g., `http://localhost:3001`)
- Docker/prod: Kong gateway (`http://localhost:8000`)

### Bin urgency and weight

`backend/bin-status/src/types.ts` defines urgency thresholds and per-category kg/litre conversion (e.g., `glass: 2.50`, `paper: 0.10`). These constants are used for estimated weight calculations sent to the orchestrator.

### Environment variables

Copy `.env.example` to `.env` for frontend dev. Backend services read from Docker Compose environment or a local `.env` via `dotenv`. Key variables:
- `KAFKA_BROKER` / `KAFKA_BROKERS` — broker address
- `KAFKA_USER` / `KAFKA_PASS` — optional SASL credentials
- `BIN_STATUS_URL`, `SCHEDULER_URL`, `NOTIFICATION_URL` — inter-service URLs
- `NEXT_PUBLIC_API_BASE_URL` — API endpoint for the frontend
