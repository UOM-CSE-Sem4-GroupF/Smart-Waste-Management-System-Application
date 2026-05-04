# SWMS Dashboard

Operational web dashboard for the **Smart Waste Management System (SWMS)**. Built with Next.js 14+ App Router, it provides real-time monitoring of smart bins, vehicle tracking, collection job management, and analytics — all in one interface.

This is an F3 sub-group deliverable. The full system also includes ESP32/Raspberry Pi firmware (F1), a Flink stream processor and FastAPI ML service (F2), and Kubernetes infrastructure with Kong, Keycloak, and Kafka (F4).

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Authentication](#authentication)
- [Architecture](#architecture)
  - [Server vs Client Components](#server-vs-client-components)
  - [Real-Time Data Flow](#real-time-data-flow)
  - [Zustand Stores](#zustand-stores)
  - [API Client](#api-client)
- [Pages](#pages)
- [Testing](#testing)
  - [Unit Tests (Vitest)](#unit-tests-vitest)
  - [Mock Service Worker (MSW)](#mock-service-worker-msw)
  - [Mock Socket Injector](#mock-socket-injector)
  - [E2E Tests (Playwright)](#e2e-tests-playwright)
- [Build and Lint](#build-and-lint)
- [Docker](#docker)
- [Bin Status Colours](#bin-status-colours)
- [Socket Events Reference](#socket-events-reference)
- [Kong API Routes](#kong-api-routes)

---

## Features

- **Live map** — Mapbox GL JS map with individual bin markers and cluster-level zoom switching. Bin pins are coloured by fill status. Vehicle positions update in real time with a 1-second throttle.
- **Bins page** — Filterable table of all bins across zones, with per-bin detail pages showing fill history and metadata.
- **Jobs page** — Two-column view of active and completed collection jobs. Per-job detail pages with progress tracking and assigned vehicle info.
- **Analytics page** — Recharts-powered charts: fill trend, zone comparison, waste category breakdown, vehicle utilisation, and collection forecast.
- **History page** — Completed job log with filters by zone, date range, and job type.
- **Alert panel** — Persistent alert tray fed by `alert:urgent`, `alert:deviation`, and `alert:escalated` socket events. Supports individual acknowledgement and bulk clear.
- **Dark / light mode** — System-preference-aware theme via `next-themes`.
- **Role-based access** — Drivers are redirected to the Flutter app. Supervisors see all zones. Only `supervisor`, `fleet-operator`, `viewer`, and `admin` roles can access the web dashboard.

---

## Tech Stack

| Concern | Library / Version |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | NextAuth.js v5 + Keycloak provider |
| REST fetching | TanStack Query v5 |
| HTTP client | `ky` v2 |
| Real-time | socket.io-client v4 |
| Global state | Zustand v5 |
| Map | Mapbox GL JS v3 |
| Charts | Recharts v3 |
| Forms | react-hook-form + zod |
| Dates | date-fns v4 |
| Unit tests | Vitest + Testing Library |
| API mocking | MSW v2 |
| E2E tests | Playwright |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider + Providers)
│   ├── page.tsx                # Root redirect (→ /dashboard or /login)
│   ├── providers.tsx           # SessionProvider + QueryClientProvider + SocketProvider
│   ├── api/auth/[...nextauth]/ # NextAuth route handler
│   ├── login/                  # Login page (triggers Keycloak redirect)
│   ├── unauthorized/           # Shown to drivers who land on the web app
│   └── dashboard/
│       ├── layout.tsx          # Shared shell: sidebar + alert tray
│       ├── page.tsx            # Dashboard overview (redirects to /map)
│       ├── map/page.tsx        # Live map page
│       ├── bins/page.tsx       # Bins list page
│       ├── bins/[id]/          # Bin detail page
│       ├── jobs/page.tsx       # Jobs list page
│       ├── jobs/[id]/          # Job detail page
│       ├── analytics/page.tsx  # Analytics charts page
│       └── history/page.tsx    # Collection history page
│
├── components/
│   ├── providers/
│   │   ├── SocketProvider.tsx  # THE ONLY place socket.on() is registered
│   │   └── ThemeProvider.tsx   # next-themes wrapper
│   ├── map/                    # Mapbox GL JS map components (SSR-disabled)
│   ├── bins/                   # BinTable, BinStatusBadge, BinDetailCard, etc.
│   ├── jobs/                   # JobsTable, JobCard, JobStatusBadge, etc.
│   ├── analytics/              # Chart components (Recharts wrappers)
│   ├── layout/                 # Sidebar, Header, AlertTray
│   ├── shared/                 # Shared primitives (LoadingSpinner, ErrorBoundary)
│   └── ui/                     # shadcn/ui generated components
│
├── store/
│   ├── mapStore.ts             # Bins + vehicles + zone stats + filters
│   ├── alertStore.ts           # Alert queue with acknowledgement
│   └── jobStore.ts             # Collection job state
│
├── lib/
│   ├── api-client.ts           # createApiClient() (server) + createClientApiClient() (client)
│   ├── socket.ts               # Socket.IO singleton (getSocket / disconnectSocket)
│   ├── mapbox.ts               # MAPBOX_TOKEN, MAPBOX_STYLE, status colours
│   ├── utils.ts                # cn() helper and misc utilities
│   └── api/
│       ├── bins.ts             # getBins, getBin, getCluster
│       ├── zones.ts            # getZones, getZoneSummary
│       ├── jobs.ts             # getJobs, getJob, getJobStats, getJobProgress
│       ├── vehicles.ts         # getVehicles, getVehicle
│       └── ml.ts               # getFillPrediction, getZoneForecast
│
├── hooks/
│   ├── useBins.ts              # TanStack Query hooks for bin data
│   ├── useVehicles.ts          # TanStack Query hooks for vehicle data
│   ├── useJobs.ts              # TanStack Query hooks for job data
│   └── useAlerts.ts            # Reads from alertStore
│
├── types/
│   ├── bin.ts                  # Bin, BinUpdatePayload, ZoneSummary, Cluster
│   ├── vehicle.ts              # ActiveVehicle, VehiclePositionPayload
│   ├── job.ts                  # CollectionJob, CollectionJobListItem
│   ├── cluster.ts              # ClusterSummary
│   ├── socket-events.ts        # All 11 Socket.IO event payload types
│   ├── next-auth.d.ts          # NextAuth session augmentation
│   └── index.ts                # Re-exports
│
├── mocks/
│   ├── handlers.ts             # MSW request handlers + static mock data (18 bins, 2 vehicles, 5 jobs)
│   ├── browser.ts              # MSW service worker setup (browser)
│   ├── server.ts               # MSW server setup (Vitest)
│   ├── MSWProvider.tsx         # Lazy-starts the MSW worker in development
│   └── MockSocketInjector.tsx  # Simulates real-time socket events in development
│
├── auth.ts                     # NextAuth config (Keycloak provider + JWT/session callbacks)
├── middleware.ts               # Route protection + driver redirect
└── test/
    └── setup.ts                # Vitest global setup (@testing-library/jest-dom)
```

---

## Prerequisites

- Node.js 20+
- The SWMS platform running locally (Keycloak, Kong, and the backend services). Start everything with:

```bash
cd Smart-Waste-Management-System-Platform
chmod +x scripts/setup-local.sh && ./scripts/setup-local.sh
```

This starts Kafka, Kong (port 30080), Keycloak (port 30180), Vault, and EMQX in Minikube.

---

## Environment Variables

Create a `.env.local` file in this directory:

```env
# NextAuth
AUTH_SECRET=<any-random-string-32-chars>
AUTH_KEYCLOAK_ID=swms-dashboard
AUTH_KEYCLOAK_SECRET=dashboard-client-secret-dev
AUTH_KEYCLOAK_ISSUER=http://localhost:30180/realms/waste-management

# Kong gateway (REST + WebSocket)
NEXT_PUBLIC_API_BASE_URL=http://localhost:30080
NEXT_PUBLIC_SOCKET_URL=http://localhost:30080

# Mapbox (required for the map page)
NEXT_PUBLIC_MAPBOX_TOKEN=<your-mapbox-public-token>
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11
```

Get a free Mapbox token at [mapbox.com](https://mapbox.com). The dashboard degrades gracefully (map page shows an error boundary) if the token is missing.

---

## Running Locally

```bash
cd Smart-Waste-Management-System-Application/dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to Keycloak to log in.

**Development credentials:**

| Role | Email | Password |
|---|---|---|
| Supervisor | `supervisor@swms-dev.local` | `swms-supervisor-dev` |
| Driver (redirected to /unauthorized) | `driver@swms-dev.local` | `swms-driver-dev` |

In development mode, MSW intercepts all `NEXT_PUBLIC_API_BASE_URL` requests and returns the static mock dataset (18 bins across 4 KL zones, 2 vehicles, 5 jobs). The `MockSocketInjector` then simulates live socket events on top of that data — bin fill levels tick up every 8 seconds and vehicle positions random-walk every 5 seconds.

---

## Authentication

Authentication uses **NextAuth v5** with a Keycloak OIDC provider. The flow is:

1. User hits any `/dashboard/*` route → `middleware.ts` checks `req.auth`.
2. If unauthenticated, redirected to `/login`.
3. `/login` triggers a Keycloak redirect (PKCE authorization code flow handled by NextAuth).
4. On callback, `auth.ts` stores the Keycloak `access_token` and `refresh_token` in the JWT cookie.
5. The `session` callback decodes the JWT to extract `role` and `zone_id` and attaches them to the session.
6. Server Components call `createApiClient()` which reads the session and adds `Authorization: Bearer <token>` to every `ky` request.
7. Client Components call `createClientApiClient(token)` using `useSession()`.
8. The Socket.IO singleton authenticates via `{ auth: { token } }` in the handshake.

Drivers (`role === 'driver'`) are blocked at `middleware.ts` and redirected to `/unauthorized` — they use the Flutter mobile app instead.

---

## Architecture

### Server vs Client Components

| Type | When to use | Notes |
|---|---|---|
| **Server Component** (default) | Initial page data fetch | Uses `createApiClient()`, no hooks, no browser APIs |
| **Client Component** (`'use client'`) | TanStack Query, Zustand, Socket.IO, Leaflet, user interaction | Must import `createClientApiClient` with token from `useSession()` |

The canonical pattern for a page:

```
Server Component (page.tsx)
  └─ fetches initial data with createApiClient()
  └─ passes data as initialData prop to ↓
     Client Component (*Client.tsx)
       └─ useQuery(..., { initialData })   ← hydrates from server data
       └─ reads from Zustand store         ← updated by real-time socket events
```

### Real-Time Data Flow

All Socket.IO event handling is centralised in `src/components/providers/SocketProvider.tsx`. **Never** call `socket.on()` outside of this file — doing so causes duplicate handlers on re-renders.

The `SocketProvider`:
1. Reads `session.accessToken` from NextAuth.
2. Calls `getSocket(token)` to get (or create) the singleton socket connection.
3. Registers all 11 event listeners, which write to the three Zustand stores.
4. Cleans up all listeners on unmount or token change.

Components subscribe to real-time data by reading from the stores, never from the socket directly:

```typescript
// ✅ Correct
const bins = useMapStore((s) => s.bins)

// ❌ Never do this in a component
socket.on('bin:update', ...)
```

### Zustand Stores

All stores use `new Map(...)` for keyed collections to ensure React re-renders:

| Store | State | Key actions |
|---|---|---|
| `mapStore` | `bins: Map<binId, BinUpdatePayload>`, `vehicles: Map<vehicleId, VehiclePositionPayload>`, `zoneStats: Map<zoneId, ZoneStatsPayload>`, `filters: MapFilters`, `selectedBinId` | `updateBin`, `setBins`, `updateVehicle`, `setVehicles`, `removeVehicle`, `updateZoneStats`, `selectBin`, `setFilter`, `getFilteredBins` |
| `alertStore` | `alerts: Alert[]`, `unacknowledgedCount: number` | `addAlert`, `acknowledgeAlert`, `clearAll` |
| `jobStore` | `jobs: Map<jobId, CollectionJob>` | `addJob`, `updateJob`, `setJobs`, `setJobsFromList`, `completeJob`, `removeJob` |

Vehicle position updates are **throttled to 1 update per vehicle per second** in `mapStore.updateVehicle` to prevent flooding React with high-frequency GPS packets.

**Important:** Always create a new Map instance when mutating store state:

```typescript
// ✅ Triggers re-render
set((state) => {
  const next = new Map(state.bins)
  next.set(key, value)
  return { bins: next }
})

// ❌ Mutates in-place — React will NOT re-render
state.bins.set(key, value)
return { bins: state.bins }
```

### API Client

`src/lib/api-client.ts` exports two factory functions:

```typescript
// Server Components and Route Handlers only
const api = await createApiClient()
const bins = await api.get('api/v1/bins').json<Bin[]>()

// Client Components (inside TanStack Query queryFn)
const { data: session } = useSession()
const api = createClientApiClient(session.accessToken)
```

Both functions configure `ky` with `NEXT_PUBLIC_API_BASE_URL` as the prefix and inject the Keycloak JWT as `Authorization: Bearer`. All requests go through Kong, which validates the token before forwarding to the backend service.

---

## Pages

| Route | Description |
|---|---|
| `/` | Redirects authenticated users to `/dashboard/map`, others to `/login` |
| `/login` | Keycloak OIDC redirect trigger |
| `/unauthorized` | Shown to drivers |
| `/dashboard/map` | Live Mapbox map with bin markers, cluster zoom switching, vehicle positions, and zone overlays |
| `/dashboard/bins` | Filterable bin table with status badges and fill level bars |
| `/dashboard/bins/[id]` | Bin detail: fill history chart, metadata, last reading time |
| `/dashboard/jobs` | Active jobs (left column) + completed/failed jobs (right column) |
| `/dashboard/jobs/[id]` | Job detail: assigned vehicle, bin progress, route waypoints |
| `/dashboard/analytics` | 5 charts: fill trend, zone comparison, category breakdown, vehicle utilisation, forecast |
| `/dashboard/history` | Paginated completed job log with zone/date/type filters |

---

## Testing

### Unit Tests (Vitest)

```bash
npm run test          # run once
npm run test -- --watch   # watch mode
```

Tests live in `src/**/*.{test,spec}.{ts,tsx}`. E2E tests are excluded.

**Setup file:** `src/test/setup.ts` imports `@testing-library/jest-dom` for DOM matchers.

**Current test coverage:**

- `src/store/__tests__/mapStore.test.ts` — comprehensive tests for `mapStore`: `updateBin` (add + merge), `setBins`, `updateVehicle` (add + throttle), `getFilteredBins` with status/category/zone filters.

**Writing store tests** — reset state in `beforeEach` using `setState`:

```typescript
beforeEach(() =>
  useMapStore.setState({
    bins: new Map(),
    vehicles: new Map(),
    zoneStats: new Map(),
    selectedBinId: null,
    filters: { status: [], wasteCategory: [], zoneId: null },
  })
)
```

### Mock Service Worker (MSW)

MSW v2 intercepts all HTTP requests to `NEXT_PUBLIC_API_BASE_URL` in **development** and **Vitest** environments.

**Handlers:** `src/mocks/handlers.ts`

Mocked endpoints:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/v1/bins` | 18 bins across 4 KL zones (KLCC, Chow Kit, Brickfields, Bangsar) |
| `GET` | `/api/v1/bins/:id` | Single bin by ID |
| `GET` | `/api/v1/zones/:id/summary` | Zone summary (total bins, status breakdown, weight, active jobs) |
| `GET` | `/api/v1/vehicles` | 2 active vehicles with real driver names |
| `GET` | `/api/v1/collection-jobs` | 5 jobs (IN_PROGRESS × 2, DISPATCHED, COMPLETED, FAILED) |

**Browser (development):** MSW is started by `MSWProvider` in `src/app/providers.tsx`. The service worker script must exist at `public/mockServiceWorker.js` — it's already committed.

**Vitest:** Import and use the MSW Node server from `src/mocks/server.ts`:

```typescript
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'
import { beforeAll, afterAll, afterEach } from 'vitest'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Override a handler for one test
server.use(
  http.get('*/api/v1/bins', () => HttpResponse.json([]))
)
```

### Mock Socket Injector

`src/mocks/MockSocketInjector.tsx` simulates real-time socket events in development without a running backend:

- **Every 8 seconds:** picks a random bin, increments its fill level by ~4%, recalculates `status` and `urgency_score`, and calls `useMapStore.updateBin()`.
- **Every 5 seconds:** each mock vehicle performs a small random walk (`±0.0008°` lat/lng) and calls `useMapStore.updateVehicle()`.
- **Occasional alerts:** triggers `useAlertStore.addAlert()` with randomised urgent/escalated alerts.

It is rendered inside `MSWProvider` and is a no-op in production (`process.env.NODE_ENV !== 'development'`).

To inspect the live socket in devtools, open the browser console and run:

```js
window.__socket.get()
```

### E2E Tests (Playwright)

```bash
# Requires the dev server to be running on http://localhost:3000
npm run test:e2e
```

Tests live in `e2e/`. Current coverage:

- `dashboard.spec.ts` — smoke test: navigating to `/` redirects unauthenticated users to the Keycloak login URL.

**Configuration:** `playwright.config.ts` sets `baseURL: 'http://localhost:3000'`. Extend with authenticated tests by storing Keycloak session state using Playwright's `storageState`.

---

## Build and Lint

```bash
npm run build    # Production build (outputs to .next/standalone)
npm start        # Serve the production build
npm run lint     # ESLint (eslint-config-next)
```

The Next.js config sets `output: 'standalone'` for minimal Docker image size.

---

## Docker

```bash
# Build
docker build -t swms-dashboard .

# Run (supply env vars at runtime)
docker run -p 3000:3000 \
  -e AUTH_SECRET=... \
  -e AUTH_KEYCLOAK_ID=swms-dashboard \
  -e AUTH_KEYCLOAK_SECRET=dashboard-client-secret-dev \
  -e AUTH_KEYCLOAK_ISSUER=http://localhost:30180/realms/waste-management \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:30080 \
  -e NEXT_PUBLIC_SOCKET_URL=http://localhost:30080 \
  -e NEXT_PUBLIC_MAPBOX_TOKEN=... \
  swms-dashboard
```

The Dockerfile uses the standalone output, so only the necessary files are copied into the image.

---

## Bin Status Colours

| Status | Tailwind class | Hex |
|---|---|---|
| `normal` | `bin-normal` | `#22c55e` |
| `monitor` | `bin-monitor` | `#eab308` |
| `urgent` | `bin-urgent` | `#f97316` |
| `critical` | `bin-critical` | `#ef4444` |
| `offline` | `bin-offline` | `#6b7280` |

These are defined in `tailwind.config.ts` under `extend.colors.bin` and also available as JavaScript constants in `src/lib/mapbox.ts` (`STATUS_COLOURS`).

---

## Socket Events Reference

All events are emitted by the notification service (Kong path `/ws`, socket.io path `/ws/socket.io`). Handlers live exclusively in `SocketProvider.tsx`.

| Event | Source service | Store action |
|---|---|---|
| `bin:update` | Bin Status Service | `mapStore.updateBin()` |
| `zone:stats` | Bin Status Service | `mapStore.updateZoneStats()` |
| `alert:urgent` | Bin Status Service | `alertStore.addAlert({ type: 'urgent' })` |
| `vehicle:position` | Scheduler Service | `mapStore.updateVehicle()` (throttled 1/s) |
| `job:progress` | Scheduler Service | `jobStore.updateJob()` |
| `job:created` | Workflow Orchestrator | `jobStore.addJob()` |
| `job:completed` | Workflow Orchestrator | `jobStore.completeJob()` + `mapStore.removeVehicle()` |
| `job:cancelled` | Workflow Orchestrator | `jobStore.removeJob()` |
| `alert:escalated` | Workflow Orchestrator | `alertStore.addAlert({ type: 'escalated' })` |
| `alert:deviation` | Scheduler Service | `alertStore.addAlert({ type: 'deviation' })` |

---

## Kong API Routes

All REST requests go through Kong at `NEXT_PUBLIC_API_BASE_URL`. Kong validates the Keycloak JWT before forwarding.

| Kong path | Backend service | Port |
|---|---|---|
| `/api/v1/bins` | bin-status-service | 3001 |
| `/api/v1/zones` | bin-status-service | 3001 |
| `/api/v1/collection-jobs` | workflow-orchestrator | 3002 |
| `/api/v1/collections` | scheduler-service | 3003 |
| `/api/v1/vehicles` | scheduler-service | 3003 |
| `/api/v1/ml` | fastapi-ml-service | 8000 |
| `/ws` | notification-service | 3004 |
