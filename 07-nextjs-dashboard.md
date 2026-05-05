# Technical Specification — Next.js Supervisor Dashboard
**Owner:** F3
**Repo:** group-f-application/web-dashboard
**Version:** 1.0
**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Mapbox GL JS · Socket.IO client · Recharts · Zustand · Axios

---

## 1. Purpose

The supervisor dashboard is the primary interface for municipality supervisors and fleet operators to monitor the city's waste collection in real time. It shows live bin fill levels on a map, tracks active collection jobs and vehicle positions, surfaces analytics and trends, and provides access to full historical data and audit trails.

The dashboard is read-heavy and real-time. Most data arrives through Socket.IO WebSocket events. REST APIs are used only for initial page loads and historical queries.

---

## 2. Users and roles

| Role | What they see | What they can do |
|------|--------------|-----------------|
| supervisor | Everything | Cancel jobs, view all analytics, export reports |
| fleet-operator | Vehicles, jobs, drivers | Reassign drivers, view operations |
| viewer | Live map, job list | Read only — no actions |

Role is embedded in the Keycloak JWT. Every page checks the role on load and hides actions the user cannot perform. Never rely solely on hiding UI — the API enforces permissions too.

---

## 3. Tech stack

```
Framework:        Next.js 14 (App Router)
Language:         TypeScript (strict mode)
Styling:          Tailwind CSS
Map:              Mapbox GL JS (@vis.gl/react-mapbox or mapbox-gl directly)
Charts:           Recharts
State:            Zustand (global) + React Query (server state)
WebSocket:        socket.io-client
HTTP client:      Axios (with interceptor for JWT refresh)
Auth:             Keycloak JS adapter (OAuth2 PKCE flow)
Icons:            Lucide React
Date handling:    date-fns
```

---

## 4. Project structure

```
web-dashboard/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              ← Keycloak redirect login
│   ├── (dashboard)/
│   │   ├── layout.tsx                ← sidebar + topbar + socket init
│   │   ├── page.tsx                  ← redirect to /map
│   │   ├── map/
│   │   │   └── page.tsx              ← View 1: live operations map
│   │   ├── jobs/
│   │   │   ├── page.tsx              ← View 2: job management
│   │   │   └── [jobId]/
│   │   │       └── page.tsx          ← job detail page
│   │   ├── analytics/
│   │   │   └── page.tsx              ← View 4: analytics and trends
│   │   └── history/
│   │       └── page.tsx              ← View 5: historical retrieval
│   └── api/
│       └── auth/
│           └── [...nextauth]/        ← if using NextAuth adapter
├── components/
│   ├── map/
│   │   ├── DashboardMap.tsx          ← main Mapbox map component
│   │   ├── BinMarker.tsx             ← individual bin marker
│   │   ├── ClusterMarker.tsx         ← cluster-level marker
│   │   ├── VehicleMarker.tsx         ← lorry marker with direction arrow
│   │   ├── RoutePolyline.tsx         ← job route drawn on map
│   │   ├── ZoneOverlay.tsx           ← zone boundary polygon
│   │   └── BinDetailPanel.tsx        ← sidebar panel when bin clicked
│   ├── jobs/
│   │   ├── ActiveJobCard.tsx         ← job card in active panel
│   │   ├── CompletedJobRow.tsx       ← row in completed jobs table
│   │   ├── JobDetailDrawer.tsx       ← full job timeline drawer
│   │   ├── JobStateBadge.tsx         ← coloured state pill
│   │   └── JobTypeBadge.tsx          ← ROUTINE / EMERGENCY badge
│   ├── analytics/
│   │   ├── WasteGenerationChart.tsx  ← stacked bar by category
│   │   ├── FillRateHeatmap.tsx       ← zones × hours heatmap
│   │   ├── CollectionEfficiency.tsx  ← planned vs actual metrics
│   │   └── VehicleUtilisation.tsx    ← utilisation per vehicle
│   ├── shared/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── AlertBanner.tsx           ← urgent alerts strip
│   │   ├── ZoneSelector.tsx          ← zone filter dropdown
│   │   ├── StatusBadge.tsx           ← bin/job status pill
│   │   ├── FillGauge.tsx             ← circular fill level gauge
│   │   └── LoadingSpinner.tsx
├── hooks/
│   ├── useSocket.ts                  ← Socket.IO connection + events
│   ├── useMapData.ts                 ← loads initial map data
│   ├── useJobData.ts                 ← loads and subscribes to jobs
│   └── useAuth.ts                   ← Keycloak token management
├── store/
│   ├── mapStore.ts                   ← Zustand: bin + vehicle state
│   ├── jobStore.ts                   ← Zustand: active jobs
│   └── alertStore.ts                 ← Zustand: pending alerts
├── lib/
│   ├── api.ts                        ← Axios instance + interceptors
│   ├── socket.ts                     ← Socket.IO client singleton
│   ├── keycloak.ts                   ← Keycloak adapter init
│   └── mapbox.ts                     ← Mapbox token + style config
├── types/
│   ├── bin.ts
│   ├── cluster.ts
│   ├── job.ts
│   ├── vehicle.ts
│   └── socket-events.ts              ← all Socket.IO event payloads
└── public/
    └── icons/                        ← waste category SVG icons
```

---

## 5. Authentication

The dashboard uses Keycloak OAuth2 PKCE flow.

### 5.1 Login flow

```typescript
// lib/keycloak.ts
import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
  realm: 'waste-management',
  clientId: 'waste-web-app'
})

export default keycloak
```

```typescript
// app/(auth)/login/page.tsx
// On page load, call keycloak.init()
// If not authenticated → keycloak.login() redirects to Keycloak
// On return, keycloak.init() resolves with token
// Store token in memory (NOT localStorage — security)
// Attach token to all Axios requests via interceptor
// Refresh token silently before it expires (keycloak.updateToken(30))
```

### 5.2 Axios interceptor

```typescript
// lib/api.ts
import axios from 'axios'
import keycloak from './keycloak'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL  // Kong gateway URL
})

api.interceptors.request.use(async (config) => {
  await keycloak.updateToken(30)  // refresh if expiring in < 30s
  config.headers.Authorization = `Bearer ${keycloak.token}`
  return config
})

export default api
```

### 5.3 Role-based rendering

```typescript
// hooks/useAuth.ts
export function useAuth() {
  const role = keycloak.realmAccess?.roles[0] ?? 'viewer'

  return {
    role,
    isSupervisor:    role === 'supervisor',
    isFleetOperator: role === 'fleet-operator',
    canCancelJobs:   role === 'supervisor',
    canExport:       role === 'supervisor'
  }
}
```

---

## 6. Socket.IO setup

### 6.1 Connection

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client'
import keycloak from './keycloak'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL, {
      path: '/ws',
      auth: { token: keycloak.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    })
  }
  return socket
}
```

### 6.2 Events to handle

All Socket.IO events received by the dashboard. Handle every one.

```typescript
// types/socket-events.ts

// Emitted when a bin's fill level or status changes
interface BinUpdateEvent {
  event_type: 'bin:update'
  bin_id: string
  cluster_id: string
  cluster_name: string
  zone_id: number
  fill_level_pct: number
  status: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline'
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

// Emitted every GPS ping from active vehicles
interface VehiclePositionEvent {
  vehicle_id: string
  driver_id: string
  job_id: string
  zone_id: number
  lat: number
  lng: number
  speed_kmh: number
  cargo_weight_kg: number
  cargo_limit_kg: number
  cargo_utilisation_pct: number
  bins_collected: number
  bins_total: number
  current_cluster: string | null
  next_cluster: string | null
}

// Emitted when a new collection job is created
interface JobCreatedEvent {
  job_id: string
  job_type: 'routine' | 'emergency'
  zone_id: number
  zone_name: string
  clusters: string[]
  vehicle_id: string
  driver_id: string
  total_bins: number
  planned_weight_kg: number
  route: RouteWaypoint[]
}

// Emitted when job state changes during execution
interface JobProgressEvent {
  job_id: string
  state: string
  zone_id: number
  bins_collected: number
  bins_total: number
  cargo_weight_kg: number
  cargo_limit_kg: number
}

// Emitted when job reaches COMPLETED state
interface JobCompletedEvent {
  job_id: string
  zone_id: number
  vehicle_id: string
  bins_collected: number
  bins_skipped: number
  actual_weight_kg: number
  duration_minutes: number
}

// Emitted when zone aggregation updates
interface ZoneStatsEvent {
  zone_id: number
  zone_name: string
  avg_fill_level_pct: number
  urgent_bin_count: number
  critical_bin_count: number
  total_bins: number
  total_estimated_weight_kg: number
  active_jobs_count: number
  unassigned_urgent_bins: number
  category_breakdown: Record<string, {
    count: number
    avg_fill: number
    total_kg: number
  }>
}

// Emitted when a bin is urgent with no active job
interface AlertUrgentEvent {
  bin_id: string
  cluster_id: string
  zone_id: number
  urgency_score: number
  waste_category: string
  estimated_weight_kg: number
  predicted_full_at: string | null
  message: string
}

// Emitted when a vehicle deviates from route
interface AlertDeviationEvent {
  vehicle_id: string
  driver_id: string
  job_id: string
  deviation_metres: number
  duration_seconds: number
  message: string
}

// Emitted when no vehicle could be dispatched
interface AlertEscalatedEvent {
  job_id: string
  zone_id: number
  reason: string
  message: string
  urgent_bins: Array<{
    bin_id: string
    urgency_score: number
    predicted_full_at: string
  }>
}

// Emitted when job is cancelled
interface JobCancelledEvent {
  job_id: string
  zone_id: number
  reason: string
}
```

### 6.3 useSocket hook

```typescript
// hooks/useSocket.ts
import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { useAlertStore } from '@/store/alertStore'

export function useSocket() {
  const { updateBin, updateVehicle } = useMapStore()
  const { addJob, updateJob, completeJob, removeJob } = useJobStore()
  const { addAlert } = useAlertStore()

  useEffect(() => {
    const socket = getSocket()

    socket.on('bin:update',        (e) => updateBin(e))
    socket.on('vehicle:position',  (e) => updateVehicle(e))
    socket.on('zone:stats',        (e) => useMapStore.getState().updateZoneStats(e))
    socket.on('job:created',       (e) => addJob(e))
    socket.on('job:progress',      (e) => updateJob(e.job_id, e))
    socket.on('job:completed',     (e) => completeJob(e))
    socket.on('job:cancelled',     (e) => removeJob(e.job_id))
    socket.on('alert:urgent',      (e) => addAlert({ type: 'urgent', ...e }))
    socket.on('alert:deviation',   (e) => addAlert({ type: 'deviation', ...e }))
    socket.on('alert:escalated',   (e) => addAlert({ type: 'escalated', ...e }))

    return () => {
      socket.off('bin:update')
      socket.off('vehicle:position')
      socket.off('zone:stats')
      socket.off('job:created')
      socket.off('job:progress')
      socket.off('job:completed')
      socket.off('job:cancelled')
      socket.off('alert:urgent')
      socket.off('alert:deviation')
      socket.off('alert:escalated')
    }
  }, [])
}
```

---

## 7. Zustand stores

### 7.1 Map store

```typescript
// store/mapStore.ts
import { create } from 'zustand'

interface BinState {
  bin_id: string
  cluster_id: string
  zone_id: number
  lat: number
  lng: number
  fill_level_pct: number
  status: string
  urgency_score: number
  estimated_weight_kg: number
  waste_category: string
  waste_category_colour: string
  predicted_full_at: string | null
  has_active_job: boolean
}

interface VehicleState {
  vehicle_id: string
  driver_id: string
  job_id: string
  lat: number
  lng: number
  speed_kmh: number
  cargo_utilisation_pct: number
  bins_collected: number
  bins_total: number
}

interface ZoneStats {
  zone_id: number
  avg_fill_level_pct: number
  urgent_bin_count: number
  critical_bin_count: number
  active_jobs_count: number
}

interface MapStore {
  bins: Map<string, BinState>
  vehicles: Map<string, VehicleState>
  zoneStats: Map<number, ZoneStats>
  selectedBinId: string | null
  selectedZoneId: number | null
  filters: {
    status: string[]
    wasteCategory: string[]
    zoneId: number | null
  }

  updateBin: (event: BinUpdateEvent) => void
  updateVehicle: (event: VehiclePositionEvent) => void
  updateZoneStats: (event: ZoneStatsEvent) => void
  selectBin: (binId: string | null) => void
  setFilter: (key: string, value: any) => void
  getFilteredBins: () => BinState[]
}

export const useMapStore = create<MapStore>((set, get) => ({
  bins: new Map(),
  vehicles: new Map(),
  zoneStats: new Map(),
  selectedBinId: null,
  selectedZoneId: null,
  filters: { status: [], wasteCategory: [], zoneId: null },

  updateBin: (event) => set((state) => {
    const bins = new Map(state.bins)
    bins.set(event.bin_id, {
      ...bins.get(event.bin_id),
      ...event
    })
    return { bins }
  }),

  updateVehicle: (event) => set((state) => {
    const vehicles = new Map(state.vehicles)
    vehicles.set(event.vehicle_id, event)
    return { vehicles }
  }),

  updateZoneStats: (event) => set((state) => {
    const zoneStats = new Map(state.zoneStats)
    zoneStats.set(event.zone_id, event)
    return { zoneStats }
  }),

  selectBin: (binId) => set({ selectedBinId: binId }),

  setFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),

  getFilteredBins: () => {
    const { bins, filters } = get()
    return Array.from(bins.values()).filter(bin => {
      if (filters.zoneId && bin.zone_id !== filters.zoneId) return false
      if (filters.status.length && !filters.status.includes(bin.status)) return false
      if (filters.wasteCategory.length &&
          !filters.wasteCategory.includes(bin.waste_category)) return false
      return true
    })
  }
}))
```

---

## 8. API calls (REST via Kong)

These are the REST API calls the dashboard makes. All go through the Kong gateway. JWT attached automatically via Axios interceptor.

```typescript
// lib/api-calls.ts

// Initial map load — all bins with current state
export const getBins = (params?: {
  zone_id?: number
  status?: string
  waste_category?: string
  page?: number
  limit?: number
}) => api.get('/api/v1/bins', { params })

// Single bin detail
export const getBin = (binId: string) =>
  api.get(`/api/v1/bins/${binId}`)

// Bin fill history (for chart in detail panel)
export const getBinHistory = (binId: string, params: {
  from?: string   // ISO 8601, default -7d
  to?: string
  interval?: '1h' | '6h' | '1d'
}) => api.get(`/api/v1/bins/${binId}/history`, { params })

// Cluster detail
export const getCluster = (clusterId: string) =>
  api.get(`/api/v1/clusters/${clusterId}`)

// Zone summary
export const getZoneSummary = (zoneId: number) =>
  api.get(`/api/v1/zones/${zoneId}/summary`)

// All zones list
export const getZones = () =>
  api.get('/api/v1/zones')

// Active + recent jobs
export const getJobs = (params?: {
  job_type?: 'routine' | 'emergency'
  state?: string
  zone_id?: number
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}) => api.get('/api/v1/collection-jobs', { params })

// Full job detail with timeline
export const getJob = (jobId: string) =>
  api.get(`/api/v1/collection-jobs/${jobId}`)

// Job stats summary
export const getJobStats = (params: {
  date_from: string
  date_to: string
  zone_id?: number
}) => api.get('/api/v1/collection-jobs/stats', { params })

// Cancel a job (supervisor only)
export const cancelJob = (jobId: string, reason: string) =>
  api.post(`/api/v1/collection-jobs/${jobId}/cancel`, { reason })

// Active vehicles
export const getActiveVehicles = () =>
  api.get('/api/v1/vehicles/active')

// Job live progress
export const getJobProgress = (jobId: string) =>
  api.get(`/api/v1/jobs/${jobId}/progress`)

// ML trends — waste generation by zone
export const getWasteTrends = (params: {
  zone_id: number
  period: 'week' | 'month' | 'quarter' | 'year'
}) => api.get('/api/v1/ml/trends/waste-generation', { params })

// ML prediction — zone generation forecast
export const getZoneForecast = (params: {
  zone_id: number
  date_range: string
}) => api.get('/api/v1/ml/predict/zone-generation', { params })
```

---

## 9. View 1 — Live operations map

**Route:** `/map`
**Purpose:** Real-time map of the entire city showing bins, vehicles, routes, and zone status.

### 9.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  TopBar: zone selector | filter panel | alert count  │
├──────────────────────────────┬──────────────────────┤
│                              │                      │
│                              │  BinDetailPanel      │
│      Mapbox map              │  (shows when bin     │
│      (fills remaining        │   is selected)       │
│       space)                 │                      │
│                              │  or empty state      │
│                              │  "Click a bin"       │
└──────────────────────────────┴──────────────────────┘
```

### 9.2 Initial data load

```typescript
// app/(dashboard)/map/page.tsx

useEffect(() => {
  // 1. Load all bins into Zustand store
  getBins({ limit: 1000 }).then(res => {
    res.data.data.forEach(bin => mapStore.updateBin(bin))
  })

  // 2. Load active vehicles
  getActiveVehicles().then(res => {
    res.data.vehicles.forEach(v => mapStore.updateVehicle(v))
  })

  // 3. Socket.IO handles all live updates from here
  // bin:update events → mapStore.updateBin()
  // vehicle:position events → mapStore.updateVehicle()
}, [])
```

### 9.3 Cluster markers on map

The map shows cluster markers, not individual bin markers. Each cluster marker represents one physical location.

```typescript
// components/map/ClusterMarker.tsx

interface ClusterMarkerProps {
  cluster_id: string
  lat: number
  lng: number
  cluster_name: string
  // These are computed from the bins at this cluster
  max_urgency_score: number
  cluster_status: 'normal' | 'monitor' | 'urgent' | 'critical'
  total_bins: number
  urgent_bins: number
  total_weight_kg: number
}

// Marker colour based on cluster_status:
const STATUS_COLOURS = {
  normal:   '#22C55E',  // green
  monitor:  '#EAB308',  // yellow
  urgent:   '#F97316',  // orange
  critical: '#EF4444'   // red
}

// Marker size based on total_weight_kg:
// 0–500kg:   24px
// 500–2000kg: 32px
// 2000kg+:    40px

// Click cluster → show all bins at this location in BinDetailPanel
// Do NOT show individual bin markers unless zoomed in very close
```

### 9.4 Zoom-based switching

```typescript
// At zoom level < 13: show ClusterMarker (one per cluster)
// At zoom level >= 13: show individual BinMarker per bin
// This prevents map from being too cluttered at city scale

map.on('zoom', () => {
  const zoom = map.getZoom()
  setShowIndividualBins(zoom >= 13)
})
```

### 9.5 Vehicle markers

```typescript
// components/map/VehicleMarker.tsx
// Shows a lorry icon at vehicle's GPS position
// Rotated to show heading_degrees (direction of travel)
// Colour: green if cargo < 70%, yellow if 70-90%, red if > 90%
// Click vehicle → show job detail drawer
// Position updates on every vehicle:position Socket.IO event
// Use smooth animation: transition position over 500ms
```

### 9.6 Route polyline

```typescript
// components/map/RoutePolyline.tsx
// Drawn when a job is created (job:created event provides route)
// One polyline per active job
// Colour coded per vehicle:
//   LORRY-01: blue, LORRY-02: purple, LORRY-03: teal, etc.
// Dashed line for pending stops, solid for completed stops
// Removed when job completes (job:completed event)
```

### 9.7 Zone boundary overlays

```typescript
// components/map/ZoneOverlay.tsx
// GeoJSON polygon per zone
// Shown/hidden via toggle in filter panel
// Fill: very light colour tint of zone (10% opacity)
// Border: 2px solid zone colour
// Label: zone name in center of polygon
```

### 9.8 Filter panel

```
Filters available:
  Zone:           dropdown (All zones | Zone-1 | Zone-2 ...)
  Status:         multi-select chips (normal | monitor | urgent | critical | offline)
  Waste category: multi-select chips (food | paper | glass | plastic | general | e-waste)
  Show zones:     toggle (show/hide zone boundary overlays)
  Show routes:    toggle (show/hide active route polylines)

All filters update mapStore.filters
mapStore.getFilteredBins() returns only matching bins
Map re-renders with filtered markers
```

### 9.9 BinDetailPanel

Opens on the right side when user clicks a cluster or bin marker.

```
┌──────────────────────────────────┐
│ [BIN-047]  🗑️ Glass              │
│ CLUSTER-012 — Central Market     │
│                                  │
│  ████████░░  85.3%               │  ← FillGauge component
│  Urgent · 510 kg                 │
│  Predicted full: 10:30 AM        │
│                                  │
│  Fill rate: +3.2% / hour         │
│  Battery: 72% 🔋                 │
│  Last reading: 2 minutes ago     │
│                                  │
│  ── 7-day fill history ──────    │
│  [line chart from InfluxDB]      │  ← Recharts LineChart
│                                  │
│  ── Recent collections ──────    │
│  Today 06:30   DRV-007  490kg    │
│  Yesterday     DRV-003  476kg    │
│  Mon Apr 13    DRV-007  501kg    │
└──────────────────────────────────┘
```

Data loaded via:
1. `mapStore.bins.get(binId)` — current state (already in store)
2. `getBinHistory(binId)` — REST call for chart data
3. `getBin(binId)` — REST call for recent collections

---

## 10. View 2 — Job management

**Route:** `/jobs`
**Purpose:** Monitor all active collection jobs and retrieve completed job history.

### 10.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  Jobs  [Active: 3]  [Completed today: 12]            │
│  [Filter: date | zone | type | driver]  [Export CSV] │
├─────────────────────┬────────────────────────────────┤
│  ACTIVE JOBS        │  COMPLETED JOBS                │
│  ─────────────────  │  ─────────────────────────────  │
│  [JobCard]         │  [table rows]                  │
│  [JobCard]         │                                │
│  [JobCard]         │                                │
└─────────────────────┴────────────────────────────────┘
```

### 10.2 Active job card

```typescript
// components/jobs/ActiveJobCard.tsx

// Each card shows:
interface ActiveJobCardProps {
  job_id: string
  job_type: 'routine' | 'emergency'
  zone_name: string
  state: string
  assigned_vehicle_id: string
  driver_name: string
  total_bins: number
  bins_collected: number
  bins_pending: number
  planned_weight_kg: number
  cargo_weight_kg: number        // live — from vehicle:position events
  cargo_limit_kg: number
  created_at: string
}

// Visual layout per card:
// ┌─────────────────────────────────────────┐
// │ 🚨 EMERGENCY  Zone 3  [IN PROGRESS]     │
// │ LORRY-03 · John Silva                   │
// │                                         │
// │ Progress: ████████░░  8 / 12 bins       │
// │ Cargo:    ████░░░░░░  640 / 2000 kg     │
// │                                         │
// │ Started: 09:18   Est. done: 10:02       │
// │                          [View details] │
// └─────────────────────────────────────────┘

// Card border colour = job state colour
// IN_PROGRESS: blue
// ESCALATED: red
// DRIVER_NOTIFIED: yellow
// DISPATCHED: purple

// Live updates: job:progress events update bins_collected and cargo_weight_kg
// No page refresh needed

// Supervisor only: [Cancel job] button visible
```

### 10.3 Job detail drawer

Opens when user clicks "View details" on any job card.

```typescript
// components/jobs/JobDetailDrawer.tsx
// Slides in from right, full height, ~600px wide

// Sections:
// 1. Header: job type, zone, state badge, cancel button
// 2. Assignment: vehicle, driver, route plan ID
// 3. Weight: planned vs actual progress bar
// 4. Bin stops: ordered list with status
//      CLUSTER-012 — Central Market
//        ✅ BIN-047 (glass)   collected 09:31 · 510kg
//        ✅ BIN-049 (paper)   collected 09:33 · 46kg
//        ⏳ BIN-052 (glass)   pending
// 5. State timeline:
//      09:14 CREATED
//      09:14 BIN_CONFIRMING
//      09:14 BIN_CONFIRMED
//      09:15 CLUSTER_ASSEMBLED
//      09:16 DISPATCHED
//      09:18 IN_PROGRESS
// 6. Hyperledger TX ID (if completed): with copy button
```

### 10.4 Completed jobs table

```
Columns: Date | Zone | Type | Driver | Bins | Weight | Duration | Efficiency | Actions
Row:     Today | Zone 3 | EMERGENCY | J.Silva | 12/12 | 640kg | 44min | 94% | [View]

Filter controls above table:
  Date range picker
  Zone dropdown
  Job type (routine / emergency)
  Driver dropdown

Pagination: 20 rows per page

Export CSV button: downloads all filtered results
  Only visible to supervisor role
```

---

## 11. View 3 — Bin detail page

**Route:** `/map` (panel within map view, not a separate page)

Already covered in Section 9.9. The bin detail panel is a right-side panel within the map view, not a separate route.

---

## 12. View 4 — Analytics and trends

**Route:** `/analytics`
**Purpose:** Historical waste generation trends, collection efficiency metrics, and zone-level analysis. All data from REST APIs — not Socket.IO.

### 12.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  Analytics                                           │
│  Zone: [Zone 3 ▼]   Period: [Last month ▼]          │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│  Chart 1     │  Chart 2                             │
│  Waste gen   │  Fill rate heatmap                   │
│  by category │  (zones × hours)                     │
│              │                                       │
├──────────────┴───────────────────────────────────────┤
│              │                                       │
│  Chart 3     │  Chart 4                             │
│  Collection  │  Vehicle utilisation                 │
│  efficiency  │                                       │
│              │                                       │
├──────────────┴───────────────────────────────────────┤
│  Chart 5: Predictive — next 7 days forecast          │
└──────────────────────────────────────────────────────┘
```

### 12.2 Chart 1 — Waste generation by category

```typescript
// components/analytics/WasteGenerationChart.tsx
// Type: Recharts BarChart (stacked bars)
// X-axis: dates (daily)
// Y-axis: kg collected
// Each bar split by waste category with category colours
// Hover tooltip shows breakdown per category per day

// Data source:
const data = await getWasteTrends({
  zone_id: selectedZone,
  period: selectedPeriod
})
// Returns: [{ date, food_waste_kg, paper_kg, glass_kg, plastic_kg, general_kg }]
```

### 12.3 Chart 2 — Fill rate heatmap

```typescript
// components/analytics/FillRateHeatmap.tsx
// Type: custom SVG grid (not in Recharts — build manually)
// X-axis: hours of day (0-23)
// Y-axis: city zones (Zone-1 through Zone-N)
// Cell colour: blue (low fill rate) → red (high fill rate)
// Shows when bins fill fastest → helps optimise collection timing

// Data source: GET /api/v1/ml/trends/waste-generation
// Aggregate fill_rate by zone and hour of day
```

### 12.4 Chart 3 — Collection efficiency

```typescript
// components/analytics/CollectionEfficiency.tsx
// Type: Recharts LineChart
// Multiple lines:
//   - Planned distance vs actual distance (km)
//   - Planned duration vs actual duration (min)
//   - On-time collection rate (%)
// X-axis: dates

// Data source: GET /api/v1/collection-jobs/stats
// date_from, date_to, zone_id
```

### 12.5 Chart 4 — Vehicle utilisation

```typescript
// components/analytics/VehicleUtilisation.tsx
// Type: Recharts BarChart (horizontal)
// X-axis: utilisation % (0-100)
// Y-axis: vehicle ID (LORRY-01, LORRY-02, ...)
// Bar colour:
//   < 60%: grey (underutilised)
//   60-85%: green (good)
//   > 85%: orange (near capacity)

// Data source: GET /api/v1/collection-jobs/stats
// Aggregated vehicle_utilisation_pct per vehicle
```

### 12.6 Chart 5 — 7-day forecast

```typescript
// Type: Recharts AreaChart
// X-axis: next 7 days
// Y-axis: predicted kg to collect
// One area per waste category (stacked)
// Shaded region = confidence interval

// Data source:
const forecast = await getZoneForecast({
  zone_id: selectedZone,
  date_range: 'next_7_days'
})
```

---

## 13. View 5 — Historical retrieval

**Route:** `/history`
**Purpose:** Search and retrieve any historical job, bin, or vehicle data.

### 13.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  History                                             │
│                                                      │
│  Search by:                                          │
│  [Bin ID ___] [Job ID ___] [Driver ▼] [Vehicle ▼]   │
│  [Zone ▼]     [Date from ___] [Date to ___]         │
│  [Search]                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Results — Jobs (47 results)         [Export CSV]    │
│  ─────────────────────────────────────────────────   │
│  [table with pagination]                             │
│                                                      │
│  Results — Bins (12 results)                         │
│  ─────────────────────────────────────────────────   │
│  [table with pagination]                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 13.2 Job search results table

```
Columns:
  Date · Zone · Type · State · Driver · Bins · Weight · Duration · Blockchain TX · Actions

Click any row → opens JobDetailDrawer (same component as View 2)
Blockchain TX column: if populated, shows link icon → copies TX ID to clipboard
Export: downloads all results as CSV
```

### 13.3 Bin search results table

```
When searching by bin_id:
  Shows bin's full collection history
  Date · Job ID · Driver · Fill at collection · Weight · Job type

Click any row → opens job detail drawer for that job
```

---

## 14. Alert system

### 14.1 Alert banner

```typescript
// components/shared/AlertBanner.tsx
// Persistent strip at top of every dashboard page
// Shows count of unacknowledged alerts
// Click to expand: shows list of alerts

// Alert types and visual treatment:
// alert:urgent     → orange  "BIN-047 is 85% full — no collection scheduled"
// alert:deviation  → yellow  "LORRY-03 is 650m off planned route"
// alert:escalated  → red     "No vehicle available for Zone 3 emergency"

// Each alert has:
//   Timestamp
//   Message text
//   [Dismiss] button → removes from store
//   [View on map] button → navigates to map, zooms to location
```

### 14.2 Alert store

```typescript
// store/alertStore.ts
interface Alert {
  id: string            // generated client-side
  type: 'urgent' | 'deviation' | 'escalated'
  message: string
  zone_id: number
  bin_id?: string
  vehicle_id?: string
  job_id?: string
  received_at: string
  acknowledged: boolean
}

interface AlertStore {
  alerts: Alert[]
  unacknowledgedCount: number
  addAlert: (alert: Omit<Alert, 'id' | 'received_at' | 'acknowledged'>) => void
  acknowledgeAlert: (id: string) => void
  clearAll: () => void
}
```

---

## 15. Colour system and status conventions

Apply these consistently across all views.

### 15.1 Bin / cluster status colours

```typescript
export const STATUS_COLOURS = {
  normal:   { bg: '#22C55E', text: '#166534', label: 'Normal' },   // green
  monitor:  { bg: '#EAB308', text: '#854D0E', label: 'Monitor' },  // yellow
  urgent:   { bg: '#F97316', text: '#7C2D12', label: 'Urgent' },   // orange
  critical: { bg: '#EF4444', text: '#7F1D1D', label: 'Critical' }, // red
  offline:  { bg: '#6B7280', text: '#1F2937', label: 'Offline' }   // grey
}
```

### 15.2 Waste category colours

```typescript
export const CATEGORY_COLOURS = {
  food_waste: '#8B4513',  // brown
  paper:      '#4169E1',  // blue
  glass:      '#228B22',  // green
  plastic:    '#FF6347',  // tomato red
  general:    '#808080',  // grey
  e_waste:    '#FFD700'   // gold
}
```

### 15.3 Job state colours

```typescript
export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:              '#6B7280',  // grey
  BIN_CONFIRMING:       '#8B5CF6',  // purple
  CLUSTER_ASSEMBLING:   '#8B5CF6',
  DISPATCHING:          '#3B82F6',  // blue
  DISPATCHED:           '#3B82F6',
  DRIVER_NOTIFIED:      '#EAB308',  // yellow
  IN_PROGRESS:          '#22C55E',  // green
  COMPLETING:           '#22C55E',
  COLLECTION_DONE:      '#10B981',  // teal
  COMPLETED:            '#6B7280',  // grey
  ESCALATED:            '#EF4444',  // red
  FAILED:               '#EF4444',
  CANCELLED:            '#6B7280',
}
```

---

## 16. Performance requirements

```
Initial map load (1000 bins):    < 2 seconds
Dashboard page navigation:       < 500ms (client-side routing)
Socket.IO event to map update:   < 100ms
Bin history chart load:          < 1 second
Analytics page charts:           < 3 seconds (multiple API calls)
Historical search results:       < 1 second
```

### 16.1 Optimisations to implement

```
Map performance:
  Use Mapbox cluster layer for bins at low zoom (built-in clustering)
  Only render markers in current viewport
  Use canvas-based markers (not DOM elements) for > 100 markers
  Throttle vehicle position updates to 1 per second max in UI
    (even if Socket.IO fires more frequently)

Data loading:
  React Query for all REST calls (caching + deduplification)
  Stale time: 30 seconds for bin data, 5 minutes for reference data
  Load zones reference data once on app init, store in Zustand

Bundle size:
  Dynamic import Mapbox GL JS (large library)
  Dynamic import Recharts (only load on analytics page)
  Code split each route
```

---

## 17. Environment variables

```bash
# .env.local

NEXT_PUBLIC_API_URL=https://api.waste-mgmt.lk
# Kong gateway base URL

NEXT_PUBLIC_WS_URL=https://api.waste-mgmt.lk
# Socket.IO server URL (same as Kong)

NEXT_PUBLIC_KEYCLOAK_URL=https://auth.waste-mgmt.lk
# Keycloak server URL

NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ3JvdXAtZiI...
# Mapbox public access token (safe to expose in client)

NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11
# Map style — light theme recommended for bin markers visibility
```

---

## 18. Acceptance criteria

The dashboard is considered complete when all of the following pass:

```
Authentication:
[ ] Login redirects to Keycloak, returns with JWT
[ ] JWT automatically attached to all API calls
[ ] JWT refreshes silently before expiry
[ ] Unauthorized users cannot access any dashboard route
[ ] Roles correctly hide/show actions (supervisor vs viewer)

Map view:
[ ] Loads all bins on initial render via REST
[ ] Cluster markers coloured by worst-bin status
[ ] Vehicle markers appear for active lorries
[ ] bin:update events update marker colour in < 100ms
[ ] vehicle:position events move vehicle marker smoothly
[ ] Clicking cluster opens BinDetailPanel with correct data
[ ] Clicking bin shows fill history chart from InfluxDB
[ ] Route polylines drawn when job:created event fires
[ ] Route polylines removed when job:completed event fires
[ ] Filter by zone, status, category works correctly
[ ] Zoom switches from cluster to individual bin markers at level 13

Jobs view:
[ ] Active jobs load on page entry
[ ] job:created event adds new card immediately
[ ] job:progress events update progress bar live
[ ] job:completed event moves job to completed panel
[ ] Job detail drawer shows correct state timeline
[ ] Supervisor can cancel a job (others cannot see button)
[ ] Completed jobs table filterable and paginated
[ ] Export CSV downloads correct data

Analytics:
[ ] All 5 charts render with correct data
[ ] Zone and period filters update all charts
[ ] Charts load within 3 seconds

History:
[ ] Search by bin_id returns collection history
[ ] Search by job_id returns job with timeline
[ ] Search by date range returns filtered results
[ ] Blockchain TX ID shown for completed jobs
[ ] Export works for supervisor role

Alerts:
[ ] alert:urgent shown in alert banner
[ ] alert:deviation shown in alert banner
[ ] alert:escalated shown in alert banner
[ ] Dismiss removes alert from banner
[ ] Alert count badge updates in real time

Performance:
[ ] Initial load < 2 seconds
[ ] No memory leaks from Socket.IO listeners
[ ] Socket reconnects automatically on disconnect
```

---

## 19. Key things to be careful about

```
1. Socket.IO token refresh
   When Keycloak token expires, the Socket.IO connection needs
   to reconnect with the new token. Handle the token:expired
   event from Keycloak and reconnect the socket.

2. Map memory leaks
   Remove all Mapbox markers and event listeners on component
   unmount. Failing to do this causes significant memory leaks
   with 1000+ markers.

3. Zustand store growing unbounded
   Vehicle positions accumulate over time. When a job completes
   (job:completed event), remove that vehicle from the vehicle
   Map in the store.

4. Race conditions on initial load
   Socket.IO events may arrive before the initial REST load
   completes. Handle this by applying Socket.IO events as
   patches on top of whatever is already in the store —
   the Map structure (keyed by bin_id) naturally handles this.

5. Mapbox access token
   The Mapbox token is public (NEXT_PUBLIC_) but should have
   URL restrictions applied in the Mapbox console to prevent
   abuse. Restrict to your domain only.
```
