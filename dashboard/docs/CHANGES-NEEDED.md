# Dashboard — Changes Needed to Match `07-nextjs-dashboard.md` Spec

> **Context:** The current `dashboard/src/` codebase was built against `spec.md`
> (NextAuth v5 · ky · Leaflet · shadcn/ui · SocketProvider pattern).
> The team's target spec is now `07-nextjs-dashboard.md`
> (keycloak-js PKCE · Axios · Mapbox GL JS · useSocket hook pattern).
> This document lists **every change** required to bring the implementation in line with the new spec.
>
> **Team decisions (explicitly kept):** NextAuth v5, ky HTTP client, SocketProvider context
> pattern, shadcn/ui, and next-themes dark mode are **retained** — the new spec's alternatives
> are a lower baseline for these specific concerns. Sections marked **SKIP** require no action.
>
> Symbols used:
> - ❌ = does not exist yet — must be added from scratch
> - 🔄 = exists but must be replaced/rewritten
> - ⚠️ = partially right — needs modification
> - ✅ = matches new spec — no change needed

---

## Priority Table

| # | Change | Area | Priority |
|---|--------|------|----------|
| 1 | ~~Replace NextAuth v5 with keycloak-js PKCE~~ | Auth | **SKIP** |
| 2 | ~~Replace ky + createApiClient with Axios + interceptor~~ | HTTP Layer | **SKIP** |
| 3 | Replace Leaflet + react-leaflet with Mapbox GL JS | Map | P0 |
| 4 | Merge binStore + vehicleStore into mapStore | Zustand | P0 |
| 5 | Update SocketProvider event handlers (no architecture change) | Real-time | P1 |
| 6 | Add History page (`/history`) | Pages | P1 |
| 7 | Add ClusterMarker zoom-based switching on map | Map | P1 |
| 8 | Add ZoneOverlay, RoutePolyline, filter panel on map | Map | P1 |
| 9 | ~~Remove shadcn/ui, rebuild components with plain Tailwind~~ | UI | **SKIP** |
| 10 | Refactor Analytics to 5 charts (add heatmap, vehicle util, forecast) | Analytics | P1 |
| 11 | Refactor Jobs page to 2-column Active + Completed layout | Jobs | P1 |
| 12 | Update alertStore (acknowledged/weight-limit/received_at type) | Zustand | P1 |
| 13 | Add getZones, getJobStats, getCluster, getZoneForecast to ky api files | API | P2 |
| 14 | Update env vars (add Mapbox token + style only) | Config | P2 |
| 15 | Remove Overview and Fleet pages (keep Bins) | Pages | P2 |
| 16 | ~~Remove next-themes dark/light toggle~~ | UI | **SKIP** |
| 17 | Update type definitions (cluster.ts, socket-events.ts) | Types | P3 |
| 18 | Add performance optimisations (throttle, canvas markers) | Perf | P3 |

---

## 1. Authentication — Keep NextAuth v5

**Status: ✅ SKIP — team decision**

> The new spec proposes keycloak-js PKCE (client-side token storage in memory). We retain
> NextAuth v5 because it stores tokens server-side, protects routes via `middleware.ts`, and
> provides `useSession()` to hooks — a more secure pattern that is already fully implemented.

No changes required. The following are **kept as-is**:
- `src/auth.ts`
- `src/middleware.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/types/next-auth.d.ts`

---

## 2. HTTP Layer — Keep ky

**Status: ✅ SKIP — team decision**

> The new spec proposes Axios for its `keycloak.updateToken(30)` request interceptor. Since we
> retain NextAuth v5, token refresh is managed by the NextAuth session automatically. The
> existing `createApiClient()` / `createClientApiClient(token)` pattern with ky continues to work.

`src/lib/api-client.ts` and all existing files in `src/lib/api/` are **kept as-is**.

### New API functions to add (to the existing ky-based files)

These endpoints are new in the spec and do not exist yet. Add them using the same ky pattern:

**Add to `src/lib/api/bins.ts`:**
```typescript
export const getCluster = (clusterId: string, api: KyInstance) =>
  api.get(`api/v1/clusters/${clusterId}`).json<Cluster>()
```

**Add to `src/lib/api/jobs.ts`:**
```typescript
export const getJobStats = (api: KyInstance, params: {
  date_from: string; date_to: string; zone_id?: number
}) => api.get('api/v1/collection-jobs/stats', { searchParams: params as Record<string, string> }).json()

export const getJobProgress = (jobId: string, api: KyInstance) =>
  api.get(`api/v1/jobs/${jobId}/progress`).json()
```

**New file `src/lib/api/zones.ts`:**
```typescript
import type { KyInstance } from 'ky'
import type { Zone } from '@/types'

export const getZones = (api: KyInstance) =>
  api.get('api/v1/zones').json<Zone[]>()

export const getZoneSummary = (zoneId: number, api: KyInstance) =>
  api.get(`api/v1/zones/${zoneId}/summary`).json()
```

> **Also:** Remove `getZoneSummary` from `src/lib/api/bins.ts` — it is now owned by `zones.ts`. Update any imports that reference `getZoneSummary` from `bins.ts` to import from `zones.ts` instead.

**Add to `src/lib/api/ml.ts`:**
```typescript
export const getZoneForecast = (api: KyInstance, params: {
  zone_id: number; date_range: string
}) => api.get('api/v1/ml/predict/zone-generation', { searchParams: params as Record<string, string> }).json()
```

---

## 3. Map — Replace Leaflet with Mapbox GL JS

**Status: 🔄 Complete replacement required**

### What to remove
```bash
npm uninstall leaflet react-leaflet @types/leaflet
```

| File | Action |
|------|--------|
| `src/components/map/MapInner.tsx` | Delete entirely |
| `src/components/map/CityMap.tsx` | Delete entirely |
| All `dynamic(() => import(...), { ssr: false })` Leaflet wrappers | Delete |

### What to add
```bash
npm install mapbox-gl @vis.gl/react-mapbox
# or: npm install mapbox-gl  (and use the native mapboxgl JS API)
npm install -D @types/mapbox-gl
```

**`src/lib/mapbox.ts`** — token + style config:
```typescript
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
export const MAPBOX_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE
  ?? 'mapbox://styles/mapbox/light-v11'
```

### New map components to create

**`src/components/map/DashboardMap.tsx`** — main map component (SSR-disabled, dynamic import):
- Initialise Mapbox map using `MAPBOX_TOKEN` and `MAPBOX_STYLE`
- Listen to `zoom` event → `setShowIndividualBins(zoom >= 13)`
- At zoom < 13: render `ClusterMarker` per unique `cluster_id`
- At zoom ≥ 13: render individual `BinMarker` per bin
- Always render `VehicleMarker` for each active vehicle
- Render `RoutePolyline` for each active job (from `job:created` events)
- Render `ZoneOverlay` when "Show zones" filter is on
- Render `BinDetailPanel` as overlay when `selectedBinId !== null`
- **Memory:** Remove all markers and event listeners on component unmount

**`src/components/map/ClusterMarker.tsx`**:
```typescript
interface ClusterMarkerProps {
  cluster_id:    string
  lat: number;  lng: number
  cluster_name:  string
  max_urgency_score:  number
  cluster_status: 'normal' | 'monitor' | 'urgent' | 'critical'
  total_bins:     number
  urgent_bins:    number
  total_weight_kg: number
}
// Colour based on cluster_status (use STATUS_COLOURS)
// Size: 24px (0-500kg) / 32px (500-2000kg) / 40px (2000kg+)
// Click → mapStore.selectBin() to open BinDetailPanel for that cluster
```

**`src/components/map/BinMarker.tsx`** — individual bin, shown at zoom ≥ 13:
```typescript
// Circle marker coloured by bin.status (STATUS_COLOURS)
// Click → mapStore.selectBin(bin.bin_id)
```

**`src/components/map/VehicleMarker.tsx`**:
```typescript
// Lorry icon rotated to heading_degrees
// Colour: green (cargo < 70%) | yellow (70-90%) | red (> 90%)
// Smooth position animation: transition over 500ms
// Click → open JobDetailDrawer for this vehicle's job
```

**`src/components/map/RoutePolyline.tsx`**:
```typescript
// One polyline per active job (from job:created event's route field)
// Colour coded per vehicle (LORRY-01: blue, LORRY-02: purple, etc.)
// Dashed line = pending stops, solid = completed
// Remove polyline when job:completed event fires for that job_id
```

**`src/components/map/ZoneOverlay.tsx`**:
```typescript
// GeoJSON polygon per zone, toggled via filter panel
// Fill: 10% opacity tint; border: 2px solid zone colour
// Label: zone name at polygon centroid
```

**`src/components/map/BinDetailPanel.tsx`** — already partially planned, but now moves inside map view (not a separate route):
- Right-side panel within the map layout
- Shows current state (from `mapStore`), 7-day fill history chart (Recharts, REST call), recent collections
- FillGauge circular component showing fill %

### Map filter panel (add to map page)
```
Filters:
  Zone:           dropdown (All | Zone-1 | Zone-2 ...)   → mapStore.setFilter('zoneId', n)
  Status:         multi-select chips                      → mapStore.setFilter('status', [...])
  Waste category: multi-select chips                      → mapStore.setFilter('wasteCategory', [...])
  Show zones:     toggle                                  → local state → shows ZoneOverlay
  Show routes:    toggle                                  → local state → shows RoutePolyline
```

---

## 4. Zustand Stores — Merge & Restructure

**Status: 🔄 binStore + vehicleStore must merge; alertStore + jobStore need updates**

### 4a. Merge binStore + vehicleStore into mapStore

**Files to delete:**
- `src/store/binStore.ts`
- `src/store/vehicleStore.ts`

**New file: `src/store/mapStore.ts`**

The new spec combines bins, vehicles, zoneStats, selectedBinId, filters, and a computed `getFilteredBins()` in a single store:

```typescript
import { create } from 'zustand'

interface MapStore {
  bins:           Map<string, BinState>
  vehicles:       Map<string, VehicleState>
  zoneStats:      Map<number, ZoneStats>
  selectedBinId:  string | null
  selectedZoneId: number | null
  filters: {
    status:        string[]
    wasteCategory: string[]
    zoneId:        number | null
  }

  updateBin:       (event: BinUpdateEvent) => void
  updateVehicle:   (event: VehiclePositionEvent) => void
  updateZoneStats: (event: ZoneStatsEvent) => void
  removeVehicle:   (vehicleId: string) => void
  selectBin:       (binId: string | null) => void
  setFilter:       (key: string, value: unknown) => void
  getFilteredBins: () => BinState[]
}

export const useMapStore = create<MapStore>((set, get) => ({
  bins:          new Map(),
  vehicles:      new Map(),
  zoneStats:     new Map(),
  selectedBinId: null, selectedZoneId: null,
  filters:       { status: [], wasteCategory: [], zoneId: null },

  updateBin: (event) => set((state) => {
    const bins = new Map(state.bins)
    bins.set(event.bin_id, { ...bins.get(event.bin_id), ...event })
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

  removeVehicle: (vehicleId) => set((state) => {
    const vehicles = new Map(state.vehicles)
    vehicles.delete(vehicleId)
    return { vehicles }
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
  },
}))
```

> **Note on `lat`/`lng` in `BinState`:** Socket `bin:update` events do **not** carry coordinates. The `lat`/`lng` fields in `BinState` are populated only by the initial REST `getBins()` load. The `updateBin()` spread-merge (`{ ...bins.get(event.bin_id), ...event }`) preserves them on subsequent socket updates because the existing store entry keeps its coordinates. Always call `getBins({ limit: 1000 })` before rendering map markers — a `bin:update` event arriving for a bin not yet in the store will create an entry with `undefined` coordinates until the REST load completes.

> **Impact:** All imports of `useBinStore` and `useVehicleStore` across components must be updated to `useMapStore`.

### 4b. alertStore — 3 changes

**File:** `src/store/alertStore.ts`

| Field/method | Current | Target | Change |
|---|---|---|---|
| `type` | `'urgent' \| 'escalated' \| 'deviation' \| 'weight-limit'` | `'urgent' \| 'deviation' \| 'escalated'` | Remove `weight-limit` |
| `dismissed` | `boolean` | `acknowledged` | Rename field |
| `dismissAlert(id)` | method | `acknowledgeAlert(id)` | Rename method |
| `received_at` | `number` (Date.now()) | `string` (ISO 8601) | Change type |

```typescript
// Updated Alert interface
export interface Alert {
  id:           string
  type:         'urgent' | 'deviation' | 'escalated'  // weight-limit removed
  message:      string
  zone_id:      number
  bin_id?:      string
  vehicle_id?:  string
  job_id?:      string
  received_at:  string       // was: number — now ISO string
  acknowledged: boolean      // was: dismissed
}

interface AlertStore {
  alerts:               Alert[]
  unacknowledgedCount:  number
  addAlert:             (alert: Omit<Alert, 'id' | 'received_at' | 'acknowledged'>) => void
  acknowledgeAlert:     (id: string) => void   // was: dismissAlert
  clearAll:             () => void
}
```

Update `SocketProvider.tsx` to stop registering the `alert:weight-limit` handler (see §5 for all required SocketProvider changes).

### 4c. jobStore — Add completeJob and removeJob

**File:** `src/store/jobStore.ts`

The new spec's `useSocket` hook calls `completeJob(e)` and `removeJob(e.job_id)` — these method names don't exist in the current store.

Add two methods:
```typescript
completeJob: (event: JobCompletedEvent) =>
  set((state) => {
    const next = new Map(state.jobs)
    const existing = next.get(event.job_id)
    if (existing) {
      next.set(event.job_id, {
        ...existing,
        state:           'COMPLETED',
        bins_collected:  event.bins_collected,
      })
    }
    return { jobs: next }
  }),

removeJob: (jobId: string) =>
  set((state) => {
    const next = new Map(state.jobs)
    next.delete(jobId)
    return { jobs: next }
  }),
```

> **Also remove** from `jobStore.ts`:
> - The `jobProgress: Map<string, JobProgress>` state field
> - The `updateJobProgress(payload)` method and its `JobProgress` type import
>
> `job:progress` events now update the main `jobs` Map directly via `updateJob(e.job_id, e)` in SocketProvider (see §5 change #4). The separate `jobProgress` map is no longer needed.

---

## 5. Real-time Layer — Keep SocketProvider (update handlers only)

**Status: ⚠️ Partial update required — architecture kept**

> The new spec proposes a `useSocket()` hook pattern. We retain the `SocketProvider` React
> context pattern from `spec.md` as it is already implemented and working. Only the event
> handler set inside SocketProvider needs to change.

`src/components/providers/SocketProvider.tsx` is **kept**. Four targeted changes are required:

**1. Remove `alert:weight-limit` handler** — this event is not emitted by the notification-service:
```typescript
// DELETE these two lines from SocketProvider:
socket.on('alert:weight-limit', (e) => addAlert({ type: 'weight-limit', ...e }))
// and its corresponding socket.off in cleanup
```

**2. Update `job:completed` handler** — the current handler uses an inline `updateJob` call; replace it with the dedicated `completeJob()` method (added in §4c):
```typescript
// REPLACE current:
// socket.on('job:completed', (payload) => updateJob(payload.job_id, { state: 'COMPLETED', ...payload }))
// WITH:
socket.on('job:completed', (e) => completeJob(e))
// socket.off('job:completed') in cleanup already exists — no change needed there
```

**3. Update `job:cancelled` handler** — the current handler uses an inline `updateJob` call; replace it with the dedicated `removeJob()` method (added in §4c):
```typescript
// REPLACE current:
// socket.on('job:cancelled', (payload) => updateJob(payload.job_id, { state: 'CANCELLED', ...payload }))
// WITH:
socket.on('job:cancelled', (e) => removeJob(e.job_id))
// socket.off('job:cancelled') in cleanup already exists — no change needed there
```

**4. Update `job:progress` handler** — the current handler calls `updateJobProgress(payload)` which writes to a separate `jobProgress` Map. Route it through `updateJob()` on the main jobs Map instead (the `jobProgress` Map is being removed in §4c):
```typescript
// REPLACE current:
// socket.on('job:progress', (payload) => updateJobProgress(payload))
// WITH:
socket.on('job:progress', (e) => updateJob(e.job_id, e))
// socket.off('job:progress') in cleanup already exists — no change needed there
```

Update the `useJobStore()` destructure at the top of `SocketProvider.tsx`: replace `updateJobProgress` with `completeJob` and `removeJob`.

---

## 6. Pages — Remove 3 Pages, Add 1 New Page

**Status: 🔄 Restructure required**

### Pages to remove
| Route | File | Reason |
|-------|------|--------|
| `/dashboard` (overview) | `src/app/dashboard/page.tsx` + `_components/OverviewClient.tsx` | Root now redirects to `/map`; aggregate stats surfaced via AlertBanner + map page |
| `/dashboard/fleet` | `src/app/dashboard/fleet/page.tsx` | Vehicle positions and cargo are visible on the map via VehicleMarker |

> The `StatCard`, `ZoneCard`, `CargoBar` components can be deleted after removing these pages.

### Page to keep — Bins

**`/dashboard/bins`** — **keep as-is**. The map and the bins table serve different purposes:
- Map = spatial discovery (where are the critical bins?)
- Bins table = operational search (show all urgent bins in Zone 3, paginate, filter by category, audit)

The `BinDetailPanel` in the map only shows one bin at a time. Supervisors doing zone audits or planning manual dispatches need the paginated table. Add a **"View as list"** link from the map filter panel pointing to `/dashboard/bins`.

> `src/app/dashboard/bins/page.tsx` and `src/app/dashboard/bins/[id]/page.tsx` are **kept**.
> `src/components/bins/BinStatusBadge.tsx` is **kept** (used by the bins table).

### Page to add

**`src/app/dashboard/history/page.tsx`** — View 5: Historical Retrieval

```
Layout:
  Search form: Bin ID | Job ID | Driver ▼ | Vehicle ▼ | Zone ▼ | Date from | Date to | [Search]
  Results — Jobs (N results):   [Export CSV — supervisor only]
    Table: Date · Zone · Type · State · Driver · Bins · Weight · Duration · Blockchain TX · [View]
  Results — Bins (N results):
    Table: Date · Job ID · Driver · Fill at collection · Weight · Job type · [View job]

Click any row → opens JobDetailDrawer (reuse the same component from Jobs view)
```

API calls used:
- `getJobs({ date_from, date_to, zone_id, ... })` — existing
- `getBinHistory(binId)` — existing
- `getJob(jobId)` — existing (for drawer)

### Redirect root

Update `src/app/dashboard/page.tsx` (instead of deleting) to:
```typescript
import { redirect } from 'next/navigation'
export default function DashboardRoot() {
  redirect('/dashboard/map')
}
```

---

## 7. Jobs Page — Refactor to 2-Column Layout

**Status: 🔄 Layout and components need rework**

### Current state
The current Jobs page has 4 filter tabs (ACTIVE / COMPLETED / ESCALATED / CANCELLED) rendered as a list.

### Target layout (per new spec Section 10.1)
```
Left column — ACTIVE JOBS:     ActiveJobCard components, live-updating via job:progress
Right column — COMPLETED JOBS: table rows, paginated, filterable
```

### New components needed
| Component | File | Purpose |
|-----------|------|---------|
| `ActiveJobCard` | `src/components/jobs/ActiveJobCard.tsx` | Replaces the current job list item |
| `CompletedJobRow` | `src/components/jobs/CompletedJobRow.tsx` | Table row in completed panel |
| `JobDetailDrawer` | `src/components/jobs/JobDetailDrawer.tsx` | Slide-in drawer (right side, ~600px) |
| `JobStateBadge` | `src/components/jobs/JobStateBadge.tsx` | Coloured state pill |
| `JobTypeBadge` | `src/components/jobs/JobTypeBadge.tsx` | ROUTINE / EMERGENCY badge |

### ActiveJobCard fields
```typescript
interface ActiveJobCardProps {
  job_id, job_type, zone_name, state, assigned_vehicle_id,
  driver_name, total_bins, bins_collected, bins_pending,
  planned_weight_kg, cargo_weight_kg, cargo_limit_kg, created_at
}
// Border colour = JOB_STATE_COLOURS[state]
// Progress bars: bins collected / total, cargo weight / limit
// Supervisor only: [Cancel job] button
// [View details] → opens JobDetailDrawer
```

### JobDetailDrawer sections
```
1. Header: job type badge, zone, state badge, cancel button (supervisor)
2. Assignment: vehicle, driver, route plan ID
3. Weight: planned vs actual progress bar
4. Bin stops: ordered list (cluster → bins with ✅/⏳ per bin)
5. State timeline: CREATED → BIN_CONFIRMING → ... (chronological)
6. Blockchain TX ID (completed jobs) with copy button
```

### JobStateStepper
The existing `JobStateStepper.tsx` (5-phase stepper) can be adapted into the JobDetailDrawer's state timeline section, or kept as-is if it fits the drawer layout.

### Job state colours (update to match new spec Section 15.3)
```typescript
export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:            '#6B7280',  // grey
  BIN_CONFIRMING:     '#8B5CF6',  // purple
  CLUSTER_ASSEMBLING: '#8B5CF6',
  DISPATCHING:        '#3B82F6',  // blue
  DISPATCHED:         '#3B82F6',
  DRIVER_NOTIFIED:    '#EAB308',  // yellow
  IN_PROGRESS:        '#22C55E',  // green
  COMPLETING:         '#22C55E',
  COLLECTION_DONE:    '#10B981',  // teal
  COMPLETED:          '#6B7280',  // grey
  ESCALATED:          '#EF4444',  // red
  FAILED:             '#EF4444',
  CANCELLED:          '#6B7280',
}
// Note: SPLIT_JOB, RECORDING_AUDIT, AUDIT_FAILED, AUDIT_RECORDED
// are NOT in the new spec's colour map — keep grey fallback for these
```

---

## 8. Analytics Page — Add 3 More Charts

**Status: ⚠️ Has 2 charts; needs 5 total**

### Current charts (keep, may need data source updates)
| Chart | Component | Data Source | Status |
|-------|-----------|-------------|--------|
| Zone fill level over time | inline in page | `/api/v1/ml/trends/waste-generation` | ✅ Keep |
| Waste category breakdown | inline in page | `useBinStore` zone stats | ✅ Keep |

### Charts to add

**Chart 2 — Fill Rate Heatmap** (new spec Section 12.3):
- New component: `src/components/analytics/FillRateHeatmap.tsx`
- **Custom SVG grid** (not Recharts) — zones × hours of day
- Cell colour: blue (low) → red (high fill rate)
- Data: aggregate `fill_rate` by zone + hour from waste-generation API

**Chart 3 — Collection Efficiency** (new spec Section 12.4):
- New component: `src/components/analytics/CollectionEfficiency.tsx`
- Recharts `LineChart` — planned vs actual distance/duration, on-time rate
- Data: `GET /api/v1/collection-jobs/stats` (needs `getJobStats()` in api-calls)

**Chart 4 — Vehicle Utilisation** (new spec Section 12.5):
- New component: `src/components/analytics/VehicleUtilisation.tsx`
- Recharts `BarChart` (horizontal) — utilisation % per vehicle
- Bar colour: grey < 60%, green 60-85%, orange > 85%
- Data: `GET /api/v1/collection-jobs/stats` (same `getJobStats()` call)

**Chart 5 — 7-day Forecast** (new spec Section 12.6):
- New component: `src/components/analytics/ZoneForecast.tsx`
- Recharts `AreaChart` — stacked areas per waste category, confidence interval shading
- Data: `getZoneForecast({ zone_id, date_range: 'next_7_days' })`

### Analytics page filters
```
Zone selector:  updates all 5 charts
Period picker:  week | month | quarter | year
```

---

## 9. Alert System — Replace AlertFeed with AlertBanner

**Status: 🔄 Component and placement change**

### Current state
`AlertFeed` component is embedded in the overview page and sidebar.

### Target
`AlertBanner` — a persistent strip **at the top of every dashboard page** showing unacknowledged alert count. Click to expand into the alert list.

**File:** `src/components/shared/AlertBanner.tsx`
```typescript
// Shows: count of unacknowledged alerts
// Expand → list of alerts:
//   alert:urgent    → orange  "BIN-047 is 85% full — no collection scheduled"
//   alert:deviation → yellow  "LORRY-03 is 650m off planned route"
//   alert:escalated → red     "No vehicle available for Zone 3 emergency"
// Each alert: timestamp | message | [Dismiss] | [View on map]
```

Update `src/components/layout/Topbar.tsx` to include `<AlertBanner />` instead of `<AlertBell />`.

---

## 10. UI Components — Keep shadcn/ui

**Status: ✅ SKIP — shadcn/ui is strictly better than the spec's plain Tailwind baseline**

> The new spec was written as a minimal greenfield baseline and does not mention shadcn/ui.
> Our existing 14-component library (Dialog, Sheet, DropdownMenu, Tooltip, Table, Tabs, etc.)
> with full accessibility and keyboard navigation is a higher quality bar than hand-rolled divs.
> Removing it would be a downgrade. `src/components/ui/`, `src/lib/utils.ts`, and
> `components.json` are **kept as-is**.

### New shared components still needed (build using shadcn/ui primitives)

These are new components the spec introduces that don't currently exist:

| Component | File | Build with |
|-----------|------|------------|
| `FillGauge` | `src/components/shared/FillGauge.tsx` | Custom SVG — no shadcn primitive needed |
| `ZoneSelector` | `src/components/shared/ZoneSelector.tsx` | shadcn `<Select>` |
| `StatusBadge` | `src/components/shared/StatusBadge.tsx` | shadcn `<Badge>` with colour variant |
| `LoadingSpinner` | `src/components/shared/LoadingSpinner.tsx` | Tailwind `animate-spin` |
| `AlertBanner` | `src/components/shared/AlertBanner.tsx` | See §9; use shadcn `<Alert>` as base |

---

## 11. Dark Mode — Keep next-themes

**Status: ✅ SKIP — already built, keeping it is strictly better**

> The new spec omits dark mode because it was written as a minimal baseline, not because
> dark mode is wrong. Our OKLCH-based dark mode design system in `globals.css` is fully
> functional and costs nothing to retain. `next-themes`, `ThemeProvider.tsx`, and
> `ThemeToggle.tsx` are **kept as-is**.

---

## 12. Type Definitions — Add cluster.ts and socket-events.ts

**Status: ⚠️ Partial — need explicit event types**

### Add `src/types/cluster.ts`
```typescript
export interface Cluster {
  cluster_id:    string
  cluster_name:  string
  lat:           number
  lng:           number
  zone_id:       number
  bin_count:     number
}
```

### Add `src/types/socket-events.ts`
Move all inline socket payload types to this file so they can be imported by the store and useSocket hook:
```typescript
export interface BinUpdateEvent { ... }       // already defined in bin.ts as BinUpdatePayload
export interface VehiclePositionEvent { ... } // already defined in vehicle.ts — must add heading_degrees: number (VehicleMarker rotates the lorry icon by this value; the new spec's socket-events type definition omits it, but the component spec requires it)
export interface JobCreatedEvent { ... }
export interface JobProgressEvent { ... }
export interface JobCompletedEvent { ... }
export interface JobCancelledEvent { ... }
export interface ZoneStatsEvent { ... }       // already defined as ZoneStatsPayload
export interface AlertUrgentEvent { ... }
export interface AlertDeviationEvent { ... }
export interface AlertEscalatedEvent { ... }
```

### Update `src/types/bin.ts`
Remove `alert:weight-limit` references. Otherwise shape is compatible.

---

## 13. Environment Variables

**Status: ⚠️ Add 2 new variables only**

Since we retain NextAuth v5 and ky, all existing env vars are kept unchanged.
Only the Mapbox variables are new.

### Keep (no changes)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:30080
NEXT_PUBLIC_SOCKET_URL=http://localhost:30080
AUTH_KEYCLOAK_ID=swms-dashboard
AUTH_KEYCLOAK_SECRET=dashboard-client-secret-dev
AUTH_KEYCLOAK_ISSUER=http://localhost:30180/realms/waste-management
AUTH_SECRET=<generated>
NEXTAUTH_URL=http://localhost:3000
```

### Add (new for Mapbox)
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ3JvdXAtZiI...
# required for Mapbox GL JS to render the map

NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11
# map visual style (light-v11 matches our UI theme)
```

Create `dashboard/.env.local.example` with all keys but empty values.

---

## 14. Performance Optimisations (new spec Section 16.1)

**Status: ❌ Not yet implemented**

| Optimisation | Where | How |
|---|---|---|
| Dynamic import Mapbox GL JS | `DashboardMap.tsx` | `dynamic(() => import('...'), { ssr: false })` |
| Dynamic import Recharts | `analytics/page.tsx` | `dynamic(() => import('recharts'))` |
| Throttle vehicle position UI updates to 1/s | `SocketProvider.tsx` or `mapStore.updateVehicle` | Track last-update timestamp, skip if < 1s ago |
| Remove vehicle from store on job:completed | `mapStore` | In SocketProvider `job:completed` handler, call `removeVehicle(event.vehicle_id)` — add `removeVehicle` to mapStore |
| Canvas-based markers for > 100 bins | `DashboardMap.tsx` | Use Mapbox's built-in symbol layer (canvas renderer) instead of DOM markers |

---

## 15. Summary — Files to Create, Modify, Delete

### Files to DELETE
```
src/components/map/MapInner.tsx
src/components/map/CityMap.tsx  (if exists)
src/components/fleet/CargoBar.tsx
src/components/shared/StatCard.tsx
src/components/shared/ZoneCard.tsx
src/components/shared/AlertFeed.tsx  (or AlertBell — §9 replaces with AlertBanner)
src/store/binStore.ts
src/store/vehicleStore.ts
src/app/dashboard/_components/OverviewClient.tsx
src/app/dashboard/fleet/ (entire directory)
```

> **Kept (not deleted):** `src/auth.ts`, `src/middleware.ts`, `src/app/api/auth/[...nextauth]/`,
> `src/types/next-auth.d.ts`, `src/components/providers/SocketProvider.tsx`,
> `src/components/providers/ThemeProvider.tsx`, `src/components/layout/ThemeToggle.tsx`,
> `src/components/layout/ConnectionBadge.tsx`, `src/lib/api-client.ts`,
> `src/lib/api/` (all files), `src/components/ui/` (all files), `components.json`,
> `src/components/bins/BinStatusBadge.tsx`, `src/app/dashboard/bins/` (entire directory)

### Files to CREATE
```
src/lib/mapbox.ts
src/lib/api/zones.ts                       ← new ky-based zones API file
src/store/mapStore.ts
src/components/map/DashboardMap.tsx
src/components/map/ClusterMarker.tsx
src/components/map/BinMarker.tsx
src/components/map/VehicleMarker.tsx
src/components/map/RoutePolyline.tsx
src/components/map/ZoneOverlay.tsx
src/components/map/BinDetailPanel.tsx
src/components/jobs/ActiveJobCard.tsx
src/components/jobs/CompletedJobRow.tsx
src/components/jobs/JobDetailDrawer.tsx
src/components/jobs/JobStateBadge.tsx
src/components/jobs/JobTypeBadge.tsx
src/components/analytics/WasteGenerationChart.tsx
src/components/analytics/FillRateHeatmap.tsx
src/components/analytics/CollectionEfficiency.tsx
src/components/analytics/VehicleUtilisation.tsx
src/components/analytics/ZoneForecast.tsx
src/components/shared/AlertBanner.tsx
src/components/shared/ZoneSelector.tsx
src/components/shared/FillGauge.tsx
src/components/shared/LoadingSpinner.tsx
src/components/shared/StatusBadge.tsx
src/types/cluster.ts
src/types/socket-events.ts
src/app/dashboard/history/page.tsx
dashboard/.env.local.example
```

### Files to MODIFY
```
package.json                          — uninstall leaflet, react-leaflet; install mapbox-gl
src/store/alertStore.ts               — dismissed→acknowledged, weight-limit removed, received_at: string
src/store/jobStore.ts                 — add completeJob(), removeJob() methods
src/components/providers/SocketProvider.tsx  — see §5: add job:completed/cancelled, remove alert:weight-limit
src/lib/api/bins.ts                   — add getCluster(); remove getZoneSummary (moved to zones.ts)
src/lib/api/jobs.ts                   — add getJobStats(), getJobProgress()
src/lib/api/ml.ts                     — add getZoneForecast()
src/app/dashboard/page.tsx            — redirect to /dashboard/map
src/app/dashboard/layout.tsx          — remove sidebar item for fleet only; add "View as list" link from map to /dashboard/bins
src/app/dashboard/map/page.tsx        — replace Leaflet map with Mapbox DashboardMap
src/app/dashboard/jobs/page.tsx       — 2-column layout, new job components
src/app/dashboard/jobs/[id]/page.tsx  — use JobDetailDrawer
src/app/dashboard/analytics/page.tsx  — add 3 more charts
```

---

## What Stays the Same ✅

These elements of the current implementation align with both specs or are retained as-is:

- TanStack Query v5 for REST caching — ✅ keep
- Zustand v4 with `new Map()` mutation pattern — ✅ keep pattern, update store files
- Recharts for charts — ✅ keep
- date-fns for dates — ✅ keep
- Lucide React icons — ✅ keep
- Tailwind CSS — ✅ keep
- All 19 `JobState` enum values (SPLIT_JOB, RECORDING_AUDIT, etc.) — ✅ keep in `types/job.ts`
- `Bin`, `BinHistory`, `ZoneSummary` type shapes — ✅ compatible, keep
- `ActiveVehicle`, `Driver` types in `types/vehicle.ts` — ✅ keep
- `CollectionJobDetail`, `CollectionJobListItem` types — ✅ keep
- Route structure `/dashboard/*` — ✅ keep (new spec uses different paths but adapting is fine)
- Bin status colours (`normal/monitor/urgent/critical/offline`) — ✅ same hex values in both specs
- Waste category colours — ✅ same hex values in both specs
- `getBin()`, `getBinHistory()`, `getJobs()`, `getJob()`, `getActiveVehicles()` — ✅ same endpoints
- NextAuth v5 + `useSession()` — ✅ keep (preferred over keycloak-js for server-side token security)
- ky HTTP client + `createApiClient()` / `createClientApiClient()` — ✅ keep
- `SocketProvider.tsx` React context pattern — ✅ keep (event handlers updated per §5)
- shadcn/ui component library (`src/components/ui/`, `components.json`) — ✅ keep
- next-themes dark/light mode — ✅ keep
