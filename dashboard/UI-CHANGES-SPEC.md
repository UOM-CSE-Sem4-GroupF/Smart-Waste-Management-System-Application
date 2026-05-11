# Dashboard UI Changes Specification
**Version:** 1.0  
**Date:** 2026-05-11  
**Author:** Group F3  
**Scope:** Visual & functional UI changes on top of the existing Next.js 14 + shadcn/ui + NextAuth v5 + ky stack

> **Build authority hierarchy:**
> 1. This document (UI/UX implementation detail)
> 2. `spec.md` (core system spec)
>
> **Tech stack change — map library replaced:** `mapbox-gl` replaces `leaflet` + `react-leaflet` + `@types/leaflet`. All other stack choices remain unchanged: Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · NextAuth v5 · ky · Socket.IO client · Zustand v4 · Recharts · react-hook-form + zod · date-fns · Lucide React  
>
> **New dependency:** `mapbox-gl` + `@types/mapbox-gl`  
> **Remove:** `leaflet` · `react-leaflet` · `@types/leaflet`

---

## Summary of Changes

| # | Area | Change | Priority |
|---|------|--------|----------|
| 1 | Map | Replace Leaflet with Mapbox GL JS across all views | **P0** |
| 2 | Overview | Add live Mapbox mini-map to Overview page | **P0** |
| 3 | Notifications | Replace AlertBell with interactive NotificationDropdown | **P0** |
| 4 | Jobs | Job click → popup drawer with route path + metadata | **P1** |
| 5 | Analytics | Build proper chart components for trend data | **P1** |
| 6 | Operations tab | New admin tab: Bins / Vehicles / Drivers / Accounts CRUD | **P1** |
| 7 | Store | Merge binStore + vehicleStore → mapStore | **P2** |
| 8 | Sidebar | Add Operations nav item, update page titles | **P2** |

---

## Design System — Tokens & Themes

All new components **must** use existing CSS variables from `globals.css` so dark/light themes apply automatically. Never use raw hex colours in JSX — use Tailwind's semantic classes.

### Colour tokens in use
```
bg-background           ← page background
bg-card                 ← card/panel surfaces
bg-muted                ← subdued fill
border-border           ← default border
text-foreground         ← primary text
text-muted-foreground   ← secondary/label text
text-primary            ← emerald accent
ring-ring               ← focus ring
```

### Status colours (Tailwind + CSS variables already in tailwind.config.ts)
```
bin-normal   → bg-bin-normal / #22c55e
bin-monitor  → bg-bin-monitor / #eab308
bin-urgent   → bg-bin-urgent  / #f97316
bin-critical → bg-bin-critical / #ef4444
bin-offline  → bg-bin-offline / #6b7280
```

### Job state colours (new — add to tailwind.config.ts under extend.colors.job)

> **Important:** Tailwind class keys are lowercase (`job.in_progress`). The `JobState` TS type uses uppercase (`'IN_PROGRESS'`). These Tailwind keys are only useful for *static* Tailwind classes like `bg-job-in_progress`. For **dynamic** colouring (e.g. `style={{ borderColor: ... }}`), use the `JOB_STATE_COLOURS` map from `src/lib/colours.ts` instead.

```typescript
job: {
  created:            '#6B7280',   // slate
  dispatching:        '#3B82F6',   // blue
  dispatched:         '#3B82F6',
  in_progress:        '#22C55E',   // green
  completing:         '#22C55E',
  collection_done:    '#10B981',   // teal
  completed:          '#6B7280',
  escalated:          '#EF4444',   // red
  failed:             '#EF4444',
  cancelled:          '#6B7280',
  bin_confirming:     '#8B5CF6',   // purple
  cluster_assembling: '#8B5CF6',
  driver_notified:    '#EAB308',   // amber
}
```

### `src/lib/colours.ts` (new file)

This file is the single source of truth for all runtime colour lookups.

```typescript
import type { BinStatus } from '@/types/bin'

/** Maps BinStatus → hex colour (mirrors tailwind bin.* config) */
export const STATUS_COLORS: Record<BinStatus, string> = {
  normal:   '#22c55e',
  monitor:  '#eab308',
  urgent:   '#f97316',
  critical: '#ef4444',
  offline:  '#6b7280',
}

/** Palette for per-zone colouring in charts and overlays (cycles when > 7 zones) */
export const ZONE_COLOURS = [
  '#3B82F6', '#8B5CF6', '#F97316', '#10B981',
  '#EF4444', '#EAB308', '#06B6D4',
]

/**
 * Maps uppercase JobState values → hex colour.
 * Use this for dynamic inline styles / canvas drawing.
 * Do NOT use the lowercase Tailwind keys (job.in_progress) for dynamic colouring.
 */
export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:             '#6B7280',
  DISPATCHING:         '#3B82F6',
  DISPATCHED:          '#3B82F6',
  IN_PROGRESS:         '#22C55E',
  COMPLETING:          '#22C55E',
  COLLECTION_DONE:     '#10B981',
  COMPLETED:           '#6B7280',
  ESCALATED:           '#EF4444',
  FAILED:              '#EF4444',
  CANCELLED:           '#6B7280',
  BIN_CONFIRMING:      '#8B5CF6',
  CLUSTER_ASSEMBLING:  '#8B5CF6',
  DRIVER_NOTIFIED:     '#EAB308',
}
```

### Aesthetic requirements for all new components
- Rounded corners: `rounded-xl` for cards, `rounded-lg` for inner elements
- Shadows: `shadow-sm` default, `shadow-md` on hover/focus (transition-shadow)
- Backdrop blur on floating panels: `backdrop-blur-xl`
- Subtle glassmorphism on overlays: `bg-background/95 backdrop-blur-sm`
- Animations: `transition-all duration-200` or `transition-shadow`
- Typography: inter/system-ui (inherited from body), `font-medium` for labels, `font-semibold` for headings
- Spacing rhythm: `space-y-4` / `gap-4` for section gaps, `gap-2` for inline items

---

## 1. Map — Replace Leaflet with Mapbox GL JS

### 1.1 Dependencies

```bash
npm uninstall leaflet react-leaflet @types/leaflet
npm install mapbox-gl
npm install -D @types/mapbox-gl
```

### 1.2 Environment variables

Add to `dashboard/.env.local` and `dashboard/.env.local.example`:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ3JvdXAtZiJ...   # required
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11  # default light
NEXT_PUBLIC_MAPBOX_STYLE_DARK=mapbox://styles/mapbox/dark-v11  # dark mode variant
```

### 1.3 `src/lib/mapbox.ts` (new file)

```typescript
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// Resolve correct style for current color scheme.
// Call this inside a 'use client' component after mounting.
export function getMapboxStyle(theme: 'light' | 'dark' | string): string {
  if (theme === 'dark') {
    return (
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_DARK ??
      'mapbox://styles/mapbox/dark-v11'
    )
  }
  return (
    process.env.NEXT_PUBLIC_MAPBOX_STYLE ??
    'mapbox://styles/mapbox/light-v11'
  )
}

// University of Moratuwa fallback coordinates
export const DEFAULT_CENTER: [number, number] = [79.8864, 6.7967] // [lng, lat]
export const DEFAULT_ZOOM = 13
```

### 1.4 Files to delete
```
src/components/map/MapInner.tsx
src/components/map/CityMap.tsx
```

### 1.5 `src/components/map/DashboardMap.tsx` (new, replaces CityMap + MapInner)

**Responsibilities:**
- SSR-disabled via `dynamic(() => import('./DashboardMap'), { ssr: false })` wrapper in consuming pages
- Initialise `mapboxgl.Map` with token, style, center, zoom
- Switch style on theme change (`useTheme()` from next-themes)
- Fallback: if `NEXT_PUBLIC_MAPBOX_TOKEN` is empty or map fails to load, show a placeholder div centred on University of Moratuwa with a brief message ("Map unavailable — check Mapbox token")
- On zoom < 13: render `ClusterMarker` per unique `cluster_id` from `mapStore`
- On zoom ≥ 13: render individual `BinMarker` per bin from `mapStore`
- Always render `VehicleMarker` for each active vehicle in `mapStore`
- Render `RoutePolyline` per active job (drawn from job's waypoints — see §4)
- Render `ZoneOverlay` when "Show zones" filter is toggled
- `BinDetailPanel` slides in from the right when `mapStore.selectedBinId !== null`
- Map navigation controls (zoom +/−, compass) positioned bottom-right
- Attribution: bottom-left, styled to match theme
- **Cleanup:** remove all markers and listeners in returned cleanup function of `useEffect`

**Props:**
```typescript
interface DashboardMapProps {
  /** Compact mode: smaller height, no filter panel, no BinDetailPanel */
  compact?: boolean
  /** Initial viewport override (used by Overview mini-map) */
  initialCenter?: [number, number]
  initialZoom?: number
  /**
   * When set, the map renders ONLY the polyline and vehicle marker for this job.
   * Used by JobDetailDrawer embedded map. Reads route from jobStore.
   */
  jobId?: string
}
```

**Full-size map height:** `h-full` (fills parent flex container)  
**Compact map height:** `h-64` (used by Overview)

### 1.6 `src/components/map/ClusterMarker.tsx`

```typescript
interface ClusterMarkerProps {
  cluster_id:      string
  lat:             number
  lng:             number
  cluster_name:    string
  cluster_status:  'normal' | 'monitor' | 'urgent' | 'critical'
  total_bins:      number
  urgent_bins:     number
  total_weight_kg: number
}
```

**Visual spec:**
- Circular marker using Mapbox `Marker` with custom DOM element
- Outer ring: `2px solid` in status colour
- Fill: 10% opacity of status colour
- Inner circle: solid status colour dot (8px)
- Badge in top-right corner: count of urgent bins (hidden if 0), red pill `bg-red-500 text-white text-[10px]`
- Size tiers (diameter):
  - 0–500 kg → 36px
  - 500–2000 kg → 44px
  - 2000 kg+ → 52px
- Tooltip (Mapbox Popup on hover): cluster name, total bins, weight
- Click → `mapStore.selectBin(null)` then open cluster detail (initially just focuses map on cluster)
- Hover: `scale-110 transition-transform`

### 1.7 `src/components/map/BinMarker.tsx`

**Visual spec:**
- Circular dot: 12px, solid fill in `STATUS_COLORS[bin.status]`
- White border 1.5px
- On hover: expand to 16px, show mini popup (bin_id, fill %, status)
- Click → `mapStore.selectBin(bin.bin_id)` to open `BinDetailPanel`
- Pulse animation for `urgent` and `critical` bins (CSS keyframe on the DOM element)

### 1.8 `src/components/map/VehicleMarker.tsx`

**Visual spec:**
- SVG truck icon (20×20px) in a rounded square container (28×28px)
- Container colour:
  - `cargo_utilisation_pct < 70` → `bg-emerald-500`
  - `70–90%` → `bg-amber-500`
  - `> 90%` → `bg-red-500`
- Icon: white truck Lucide icon (`Truck`)
- Rotation arrow: small chevron below icon pointing in `heading_degrees` direction
- Smooth position transition: animate with `requestAnimationFrame` over 500ms
- Click → open `JobDetailDrawer` for `vehicle.job_id`
- Tooltip on hover: vehicle_id, driver name, cargo %, bins collected/total

### 1.9 `src/components/map/RoutePolyline.tsx`

Rendered as Mapbox `GeoJSON` source + `line` layer (not DOM marker).

**Visual spec:**
- One polyline per active job
- Colour palette (cycle by job index or vehicle ID hash):
  - Vehicle 1: `#3B82F6` (blue)
  - Vehicle 2: `#8B5CF6` (purple)
  - Vehicle 3: `#F97316` (orange)
  - (cycle for more)
- Line width: 3px
- **Completed stops segment:** solid line
- **Pending stops segment:** dashed (`line-dasharray: [2, 2]`)
- Remove layer/source on `job:completed` event
- Source data: `job.route.waypoints` array from job store (`job:created` event populates route)

### 1.10 `src/components/map/ZoneOverlay.tsx`

Rendered as Mapbox `GeoJSON` fill layer.

**Visual spec:**
- Zone polygon fill: status colour at 8% opacity
- Zone polygon border: status colour at 60% opacity, 2px
- Zone label: centroid of polygon, `text-xs font-semibold` style layer in Mapbox
- Per zone colour: unique from ZONE_COLOURS palette (same as analytics charts)
- Toggled by filter panel "Show zones" switch

### 1.11 `src/components/map/BinDetailPanel.tsx`

Side panel (right side, 360px wide) that slides in when a bin is selected.

**Visual spec:**
- Position: fixed right panel inside map container, `translate-x-full` → `translate-x-0` transition
- Background: `bg-card/95 backdrop-blur-xl border-l border-border`
- Header: bin_id, cluster name, zone name, status badge (using `StatusBadge` component), `[X]` close button
- `FillGauge` circular SVG component: fill_level_pct, status colour ring (see §10.1)
- Stats row: estimated_weight_kg, battery_level_pct, predicted_full_at
- 7-day fill history `LineChart` (Recharts, height 120px)
  - Data source: call `getBinHistory(api, bin.bin_id)` via `useQuery` inside the panel (only fetched when panel opens). Use `<ChartSkeleton className="h-[120px]" />` as loading state.
- Recent collections list (last 3): date, driver, fill at collection
  - Data source: `bin.recent_collections` from a `getBin(api, bin_id)` call (single bin detail endpoint — only the full detail response includes `recent_collections`). Also fetched lazily via `useQuery` when panel opens.
- Footer: "View full detail →" link to `/dashboard/bins/[bin_id]`

### 1.12 Map filter panel (full-size map only)

Floating panel, top-left inside the map container.

```
bg-card/95 backdrop-blur-xl rounded-xl shadow-lg p-3
┌─────────────────────────────────────────────────────┐
│  Zone:   [All zones ▼]                               │
│  Status: [normal] [monitor] [urgent] [critical]      │
│            (toggleable chips, multi-select)          │
│  ─────────────────────────────────────────────────   │
│  [🗂 Show zones]    toggle switch                    │
│  [🛣 Show routes]   toggle switch                    │
│  ─────────────────────────────────────────────────   │
│  [View as list →]  /dashboard/bins                   │
└─────────────────────────────────────────────────────┘
```

Filter state: `mapStore.filters` (Zustand) for zone/status/category; local React state for show-zones / show-routes toggles.

---

## 2. Overview Page — Add Live Mini-Map

### 2.1 Layout change

Current overview layout (top to bottom):
1. Stat cards row
2. Zone cards grid
3. Alert feed + Active jobs

New layout:
1. Stat cards row (unchanged)
2. **Two-column row:** Left (60%) = Zone cards grid | Right (40%) = Live mini-map
3. Alert feed + Active jobs (unchanged)

### 2.2 Mini-map implementation

Use `DashboardMap` with `compact={true}`:

```tsx
// In OverviewClient.tsx — wrap in dynamic import (SSR disabled)
const MiniMap = dynamic(() => import('@/components/map/DashboardMap'), { ssr: false })

// In JSX:
<div className="grid gap-6 lg:grid-cols-5">
  {/* Zone cards — 3 columns */}
  <div className="col-span-3">
    <ZoneCardsGrid zones={allZones} />
  </div>
  {/* Live mini-map — 2 columns */}
  <div className="col-span-2">
    <Card className="h-64 overflow-hidden rounded-xl shadow-sm">
      <MiniMap compact initialZoom={11} />
    </Card>
  </div>
</div>
```

**Mini-map features:**
- Shows bin markers (no cluster switching — always show clusters at compact zoom)
- Shows vehicle markers
- No filter panel
- No BinDetailPanel (clicking a bin navigates to `/dashboard/map` instead)
- Navigation controls hidden in compact mode
- Link chip "Open full map →" in top-right corner of the card (absolute positioned)
- Auto-fits to first-loaded bin bounds with `fitBounds` after REST data arrives

---

## 3. Notifications — NotificationDropdown

### 3.1 Replace AlertBell

**File to modify:** `src/components/layout/AlertBell.tsx` → rename usage to `NotificationDropdown` (keep file path for now, replace internals)

**New behaviour:** clicking the bell icon opens a shadcn `<Popover>` dropdown panel (not a full-page navigation). The existing `AlertFeed` component becomes the body of this popover.

### 3.2 `src/components/layout/AlertBell.tsx` — rewrite

```tsx
'use client'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAlertStore } from '@/store/alertStore'
import { NotificationList } from './NotificationList'

export function AlertBell() {
  const unread = useAlertStore((s) => s.alerts.filter((a) => !a.dismissed).length)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center
              justify-center rounded-full bg-red-500 text-[10px] font-bold text-white
              animate-in fade-in zoom-in-50 duration-200">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 p-0 rounded-xl shadow-xl border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px]
                font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {unread} new
              </span>
            )}
          </div>
          <ClearAllButton />
        </div>
        {/* Alert list */}
        <ScrollArea className="h-[420px]">
          <NotificationList />
        </ScrollArea>
        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            Showing last 50 alerts. Real-time via Socket.IO.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**`ClearAllButton`** is a small inline component defined at the bottom of the same `AlertBell.tsx` file:
```tsx
function ClearAllButton() {
  const clearAll = useAlertStore((s) => s.clearAll)
  return (
    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-auto py-1"
      onClick={clearAll}>
      Clear all
    </Button>
  )
}
```

### 3.3 `src/components/layout/NotificationList.tsx` (new — extracted from AlertFeed)

Extract the alert rendering logic from `AlertFeed.tsx` into `NotificationList.tsx`. The standalone `AlertFeed` in the Overview page continues to use the original `AlertFeed.tsx`.

**Visual spec per notification item:**
```
┌──────────────────────────────────────────────────────────────┐
│  [🔴 icon]  BIN-047 is 85% full — urgent             2m ago │
│             Zone 3 · Bin BIN-047             [Dismiss]  [→]  │
└──────────────────────────────────────────────────────────────┘
```

- Alert type → icon + left border colour:
  - `urgent`    → `Bell` icon, `border-l-4 border-rose-500`
  - `escalated` → `AlertTriangle`, `border-l-4 border-orange-500`
  - `deviation` → `Navigation`, `border-l-4 border-amber-500`
- Background on hover: `bg-muted/60`
- `[→]` "View on map" button: navigates to `/dashboard/map` and (if `bin_id`) selects that bin in `mapStore`
- `[Dismiss]` calls `dismissAlert(id)`
- New/unread items have a subtle left indicator dot `w-1.5 h-1.5 bg-blue-500 rounded-full`
- Empty state: centered bell icon + "All caught up — no active alerts."

### 3.4 `src/components/shared/AlertBanner.tsx` (new — persistent banner)

For pages where a prominent top-of-page alert strip is useful (the spec recommends this as a persistent warning bar for critical events).

```
Only visible when alerts.filter(a => a.type === 'escalated' && !a.dismissed).length > 0
```

```tsx
// Shows at the very top of <main> in layout.tsx, above the page content
// Sliding in from top using animate-in slide-in-from-top
// bg-red-500/10 border border-red-200 text-red-700 rounded-lg
// Content: "⚠ {count} escalated alert(s) — {latest message}"
// [View alerts] button → opens the NotificationDropdown via `?panel=alerts` URL search param.
// AlertBell reads useSearchParams() and auto-opens its Popover when this param is present.
// Example: router.push(`${pathname}?panel=alerts`) from the AlertBanner click handler.
// [Dismiss all escalated] button
```

---

## 4. Jobs Page — Job Click → Route + Metadata Popup

### 4.1 Current state

Jobs page shows tabs (ACTIVE / COMPLETED / ESCALATED / CANCELLED) with `JobCard` components. Clicking a job navigates to `/dashboard/jobs/[id]`.

### 4.2 New behaviour

Keep the tab layout. Change `JobCard` so clicking it **opens a `JobDetailDrawer`** (shadcn `<Sheet>` side panel) instead of navigating away. The `/dashboard/jobs/[id]` route remains for deep-linking.

### 4.3 `src/components/jobs/JobDetailDrawer.tsx` (new)

**Container:** shadcn `<Sheet side="right">`, width `max-w-xl w-full` (600px max)

**Sections:**

```
┌─────────────────────────────────────────── [X] ┐
│  ROUTINE ⬛  Job a3b4f8…              CANCELLED │
│  Zone 3 — Kaduwela     Assigned: LORRY-02       │
├──────────────────────────────────────────────────┤
│  ROUTE MAP (embedded — 240px height)             │
│  Mapbox mini-map, compact=true, shows ONLY this  │
│  job's RoutePolyline + vehicle marker            │
├──────────────────────────────────────────────────┤
│  ASSIGNMENT                                      │
│  Driver:  John Perera · DR-007                  │
│  Vehicle: LORRY-02 · 8t capacity                │
│  Route plan: RP-2024-001                        │
├──────────────────────────────────────────────────┤
│  PROGRESS                                        │
│  Bins: [████████░░░░] 8 / 12 collected          │
│  Weight: [██████░░░░] 4.2 / 6.0 t              │
│  Cargo: 70.0% utilisation                       │
├──────────────────────────────────────────────────┤
│  BIN STOPS (ordered)                             │
│  ✅ BIN-001 · Cluster A · 85% full at collection│
│  ✅ BIN-002 · Cluster A                          │
│  ⏳ BIN-003 · Cluster B (next stop)             │
│  ○  BIN-004 · Cluster B                          │
│  [Show all 12 stops ▼]                          │
├──────────────────────────────────────────────────┤
│  STATE TIMELINE                                  │
│  ● CREATED          10:00 AM                    │
│  ● BIN_CONFIRMING   10:01 AM                    │
│  ● DISPATCHED       10:05 AM                    │
│  ○ IN_PROGRESS      (current)                   │
├──────────────────────────────────────────────────┤
│  METADATA                                        │
│  Created: May 11, 2026 10:00 AM                 │
│  Priority: HIGH (score: 87)                     │
│  Blockchain TX: 0x4a3b… [copy]  (completed only)│
├──────────────────────────────────────────────────┤
│  Supervisor only:  [Cancel Job]                  │
└──────────────────────────────────────────────────┘
```

**Embedded route map:**
- `DashboardMap` with `compact={true}` but filtered to show ONLY markers related to this job
- Pass `jobId` prop to the compact map — it reads route from `jobStore` and draws the polyline
- Falls back to University of Moratuwa if no route waypoints
- Height: 240px fixed

**Data sources:**
- Static fields (zone_name, driver, vehicle, state) → from `jobStore` (populated by socket events)
- Bin stops list → from `getJob(jobId)` REST call (full detail endpoint)
- 7-day history → not needed here

**Opening the drawer:**
```tsx
// In jobs/page.tsx
const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

// JobCard now:
<JobCard job={job} onClick={() => setSelectedJobId(job.id)} />

// Drawer:
<JobDetailDrawer
  jobId={selectedJobId}
  open={selectedJobId !== null}
  onClose={() => setSelectedJobId(null)}
/>
```

### 4.4 `src/components/jobs/ActiveJobCard.tsx` (update existing `JobCard`)

Keep file as `JobCard.tsx`, add `onClick` prop. Add visual improvements:

```
┌──────────────────────────────────────────────────────────┐
│  [ROUTINE] [IN_PROGRESS]          Zone 3 · 12 stops      │
│  a3b4f8… · LORRY-02 · John Perera                        │
│  ──────────────────────────────────────────────────────   │
│  Bins:   [██████░░░░░░░░░░] 8 / 12                        │
│  Weight: [████████░░░░░░░░] 4.2 / 6.0 t                  │
│  ──────────────────────────────────────────────────────   │
│  Started 23 minutes ago         [Cancel] [View details]   │
└──────────────────────────────────────────────────────────┘
```

- Left border colour = `JOB_STATE_COLOURS[state]` (4px left border)
- Progress bars: `h-1.5 rounded-full bg-muted` with `bg-emerald-500` inner bar
- Hover: `shadow-md cursor-pointer`

### 4.5 New shared job components to create

| File | Purpose |
|------|---------|
| `src/components/jobs/JobDetailDrawer.tsx` | Main drawer (see §4.3) |
| `src/components/jobs/JobStateBadge.tsx` | Coloured pill for job states |
| `src/components/jobs/JobTypeBadge.tsx` | ROUTINE/EMERGENCY badge |
| `src/components/jobs/JobProgressBar.tsx` | Reusable progress bar (bins/weight) |
| `src/components/jobs/BinStopList.tsx` | Ordered bin stops with ✅/⏳/○ status |
| `src/components/jobs/StateTimeline.tsx` | Vertical timeline of state transitions |

---

## 5. Analytics Page — Trend Chart Components

### 5.1 Current state

Analytics page has inline chart code for:
- Zone fill level line chart (from `/api/v1/ml/trends/waste-generation`)
- Waste category bar chart (from binStore zone stats)
- Predictions table (from binStore bins)
- Collection efficiency (from jobStore)

### 5.2 Target: 5 dedicated chart components + improved layout

**Page layout:**
```
Analytics
├── Filter bar: [Zone selector ▼] [Period: Week | Month | Quarter | Year]
├── Row 1: [Zone Fill Trends] (full width line chart, multi-zone)
├── Row 2: [Waste Category Breakdown] + [Fill Rate Heatmap]
├── Row 3: [Collection Efficiency] + [Vehicle Utilisation]
└── Row 4: [7-day Zone Forecast] (full width area chart)
```

### 5.3 `src/components/analytics/ZoneFillTrendsChart.tsx` (extract + improve)

- Recharts `LineChart` with `ResponsiveContainer`
- Multiple lines: one per zone, colour from `ZONE_COLOURS`
- X-axis: dates (formatted with `date-fns format(date, 'MMM d')`)
- Y-axis: fill level % (0–100)
- Tooltip: custom `<CustomTooltip>` showing all zone values at that date, styled with `bg-card shadow-lg rounded-lg p-2`
- Legend: zone names with colour dots
- Loading skeleton: `<Skeleton className="h-64 w-full rounded-xl" />`
- Empty state: "No trend data available for selected period"

### 5.4 `src/components/analytics/WasteCategoryChart.tsx` (extract + improve)

- Recharts `BarChart` (horizontal for readability)
- Categories on Y-axis, weight (kg) on X-axis
- Bar colour: each category has a unique colour from spec (food_waste: green, paper: blue, etc.)
- Click on bar: filters bins table on `/dashboard/bins?category=X`

### 5.5 `src/components/analytics/FillRateHeatmap.tsx` (new)

- Custom SVG grid: rows = zones, columns = hours of day (0–23)
- Cell colour: `interpolate(blue → red)` based on fill rate value
- Cell size: `~28×28px`, rounded `rounded-sm`
- Tooltip on cell hover: `Zone X · Hour Y:00 — Z% avg fill rate`
- Colour scale legend: horizontal gradient bar below chart
- Data source: aggregate from `getWasteGenerationTrends` (group by zone + hour)

```
         0  1  2  3  4  5  6  7  8  9  10 11 12 ... 23
Zone 1  [░][░][░][░][░][▒][▒][█][█][█][▓][▓][▓]...[░]
Zone 2  [░][░][░][░][▒][▒][█][█][█][▓][▓][▓][▒]...[░]
...
```

### 5.6 `src/components/analytics/CollectionEfficiencyChart.tsx` (extract + improve)

- Recharts `LineChart`: two lines — "Planned duration" (dashed) vs "Actual duration" (solid)
- X-axis: date, Y-axis: minutes
- A third line: on-time rate % (right Y-axis, secondary)
- Data source: `getJobStats(api, { date_from, date_to })` (REST call)
- Loading state and empty state handled

### 5.7 `src/components/analytics/VehicleUtilisationChart.tsx` (new)

- Recharts `BarChart` (horizontal)
- One bar per vehicle: utilisation % across period
- Bar colour: grey < 60%, emerald 60-85%, orange > 85% (dynamic fill via `Cell` component)
- Data source: same `getJobStats()` call

### 5.8 `src/components/analytics/ZoneForecastChart.tsx` (new)

- Recharts `AreaChart`: stacked areas per waste category
- 7 data points (next 7 days)
- Confidence interval: shaded band using two `Area` layers (upper/lower CI)
- Data source: `getZoneForecast({ zone_id, date_range: 'next_7_days' })`
- Zone selector at chart header (local state, not global)

### 5.9 New shared components needed for analytics

| File | Purpose |
|------|---------|
| `src/components/shared/ZoneSelector.tsx` | shadcn `<Select>` seeded with zones from mapStore |
| `src/components/analytics/ChartSkeleton.tsx` | Loading skeleton placeholder (h-64 w-full) |
| `src/components/analytics/ChartCard.tsx` | Card wrapper with title, subtitle, optional zone filter |

---

## 6. Operations Tab — Admin CRUD

### 6.1 New route: `/dashboard/operations`

New nav item in Sidebar (visible to roles: `supervisor`, `admin` only):

```typescript
{ icon: Settings2, label: 'Operations', href: '/dashboard/operations', roles: ['supervisor', 'admin'] }
```

### 6.2 Page layout: Tabbed CRUD interface

```
Operations
├── [Bins] [Vehicles] [Drivers] [Accounts]  ← shadcn <Tabs>
│
├── Bins tab
├── Vehicles tab
├── Drivers tab
└── Accounts tab
```

Page header:
```
Operations                                    [+ Add Bin]  ← context button changes per tab
Management panel — add, update, or deactivate assets in the SWMS.
```

### 6.3 Bins Tab

**`src/app/dashboard/operations/page.tsx`** contains all tabs.

**Bins sub-tab layout:**
```
Search: [Bin ID or address...] [Zone ▼] [Status ▼] [Category ▼]  [+ Add New Bin]
─────────────────────────────────────────────────────────────────────────────────
Table:
  ID | Address | Zone | Status | Fill % | Category | Battery | Last Seen | Actions
  ─────────────────────────────────────────────────────────────────────────────
  BIN-001 | 14 Main St | Zone 3 | 🟢 Normal | 42% | Food | 78% | 2m ago | [Edit] [Deactivate]
  BIN-002 | ...
─────────────────────────────────────────────────────────────────────────────────
Page: [← Prev]  1  2  3  ...  [Next →]   Showing 1-25 of 312
```

**Add/Edit Bin — `<BinFormDialog>` component:**

Triggered by [+ Add New Bin] or [Edit]. Uses shadcn `<Dialog>`.

```
Dialog: Add New Bin / Edit Bin BIN-001
─────────────────────────────────────────
Bin ID*          [BIN-NNN_____]   (read-only on edit)
Zone*            [Zone 3 ▼]
Cluster*         [Cluster A ▼]   (filtered by zone)
Address*         [14 Main Street, Colombo]
Latitude*        [6.9271]
Longitude*       [79.8612]
Waste Category*  [Food Waste ▼]
Capacity (kg)*   [50]
Install Date     [2024-01-15]
─────────────────────────────────────────
[Cancel]                        [Save Bin]
```

- Form validation: react-hook-form + zod schema
- API call: `POST /api/v1/bins` (create) or `PATCH /api/v1/bins/:bin_id` (edit)
- On success: invalidate TanStack Query cache + show `<toast>` "Bin saved successfully"
- On error: show field-level errors inline

**Deactivate Bin — confirmation dialog:**
```
shadcn <AlertDialog>: "Deactivate BIN-001?"
"This bin will stop reporting and be excluded from job planning."
[Cancel]  [Deactivate]  → PATCH /api/v1/bins/:id { active: false }
```

### 6.4 Vehicles Tab

**Table columns:**
```
Vehicle ID | Type | Capacity | Driver | Status | Last Location | Last Job | Actions
LORRY-01 | Garbage Truck | 8t | John Perera | 🟢 Active | Zone 3 | JOB-001 | [Edit] [Deactivate]
```

**Add/Edit Vehicle — `<VehicleFormDialog>`:**

> **Type note:** `src/types/vehicle.ts` must be updated before implementing this form. The existing `Vehicle` interface does not include `registration` or `year` fields. Add a `VehicleAsset` interface (or extend `Vehicle`) with at minimum: `registration: string`, `year: number`.

```
Vehicle ID*      [LORRY-NNN____]  (read-only on edit)
Vehicle Type*    [Garbage Truck ▼]
Capacity (kg)*   [8000]
Registration*    [CAA-1234]
Year             [2022]
──────────────────────────────────
[Cancel]                   [Save Vehicle]
```

API: `POST /api/v1/vehicles` / `PATCH /api/v1/vehicles/:vehicle_id`

### 6.5 Drivers Tab

**Table columns:**
```
Driver ID | Name | Phone | Zone | Vehicle | Status | Actions
DR-001 | John Perera | +94 77 123 4567 | Zone 3 | LORRY-01 | 🟢 On Job | [Edit] [Deactivate]
```

**Add/Edit Driver — `<DriverFormDialog>`:**

> **Type note:** `src/types/vehicle.ts` must be updated before implementing this form. The existing `Driver` interface does not include `email`, `phone`, or `license_no` fields. Add these to the `Driver` interface: `email: string`, `phone: string`, `license_no: string`.

```
Driver ID*       [DR-NNN_____]   (read-only on edit)
Full Name*       [John Perera]
Email*           [john@swms.lk]
Phone*           [+94 77 123 4567]
Assigned Zone*   [Zone 3 ▼]
Assigned Vehicle [LORRY-01 ▼]   (optional — can be unassigned)
License No.*     [B1234567]
──────────────────────────────────
[Cancel]                   [Save Driver]
```

API: `POST /api/v1/drivers` / `PATCH /api/v1/drivers/:driver_id`

> **Keycloak account note:** When creating a new driver, there is a secondary step to create their Keycloak account (see §6.6 Accounts tab). The driver form has a prompt: "Create login account for this driver? →" link to Accounts tab pre-filled.

### 6.6 Accounts Tab

Manage dashboard user accounts. Only `admin` role can access this sub-tab (hide from `supervisor`).

```
Search: [Name or email...] [Role ▼]  [+ Create Account]
─────────────────────────────────────────────────────────────────────────────────
Table:
  Username | Email | Role | Zone | Status | Last Login | Actions
  supervisor@swms.lk | Supervisor Alex | supervisor | All zones | 🟢 Active | 3h ago | [Edit] [Disable]
  driver@swms.lk     | John Perera     | driver     | Zone 3     | 🟢 Active | 1d ago | [Edit] [Disable]
```

**Create Account — `<AccountFormDialog>`:**

```
Full Name*       [John Perera]
Email*           [john.perera@swms.lk]
Role*            [driver ▼]  (supervisor / fleet-operator / driver / viewer)
Zone             [Zone 3 ▼]  (only for driver role — sets zone_id JWT claim)
Linked Driver    [DR-001 - John Perera ▼]  (only for driver role)
─────────────────────────────────────────
Temporary password will be auto-generated and sent to their email.
──────────────────────────────────────────────────────────────────
[Cancel]                              [Create Account]
```

API: Calls backend API proxy → Keycloak Admin API via server action or `/api/admin/accounts` Next.js route handler. Never expose Keycloak admin credentials to the client.

> **Security note:** Account management must go through a server-side Next.js API route (`/app/api/admin/accounts/route.ts`). The client sends the form data to this Next.js endpoint; the endpoint validates the session role (must be `admin`), then calls Keycloak Admin REST API using the admin secret from env. **Never** send Keycloak admin credentials to the browser.

### 6.7 Operations page files to create

```
src/app/dashboard/operations/
  page.tsx                       ← main tabbed page (Server Component wrapper)
  _components/
    OperationsClient.tsx         ← 'use client' wrapper with tab state
    BinsTab.tsx                  ← bins table + search
    VehiclesTab.tsx              ← vehicles table
    DriversTab.tsx               ← drivers table
    AccountsTab.tsx              ← accounts table (admin only)
    BinFormDialog.tsx            ← add/edit bin dialog
    VehicleFormDialog.tsx        ← add/edit vehicle dialog
    DriverFormDialog.tsx         ← add/edit driver dialog
    AccountFormDialog.tsx        ← create account dialog

src/lib/api/
  drivers.ts                     ← getDrivers(), createDriver(), updateDriver()
  admin.ts                       ← createAccount(), listAccounts(), disableAccount()
```

---

## 7. Store Changes — mapStore

### 7.1 Files to delete
```
src/store/binStore.ts
src/store/vehicleStore.ts
```

### 7.2 New file: `src/store/mapStore.ts`

```typescript
import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload, VehiclePositionPayload } from '@/types'

interface MapFilters {
  status:        string[]
  wasteCategory: string[]
  zoneId:        number | null
}

interface MapStore {
  // State
  bins:           Map<string, BinUpdatePayload>
  vehicles:       Map<string, VehiclePositionPayload>
  zoneStats:      Map<number, ZoneStatsPayload>
  selectedBinId:  string | null
  selectedZoneId: number | null
  filters:        MapFilters

  // Mutations
  updateBin:       (payload: BinUpdatePayload) => void
  setBins:         (bins: BinUpdatePayload[]) => void
  updateVehicle:   (payload: VehiclePositionPayload) => void
  removeVehicle:   (vehicleId: string) => void
  updateZoneStats: (payload: ZoneStatsPayload) => void
  selectBin:       (binId: string | null) => void
  selectZone:      (zoneId: number | null) => void
  setFilter:       (key: keyof MapFilters, value: MapFilters[keyof MapFilters]) => void

  // Computed
  getFilteredBins: () => BinUpdatePayload[]
}

export const useMapStore = create<MapStore>((set, get) => ({
  bins:          new Map(),
  vehicles:      new Map(),
  zoneStats:     new Map(),
  selectedBinId: null,
  selectedZoneId: null,
  filters:       { status: [], wasteCategory: [], zoneId: null },

  updateBin: (payload) =>
    set((state) => {
      const next = new Map(state.bins)
      // Preserve lat/lng from initial REST load (socket events don't include coords)
      const existing = next.get(payload.bin_id)
      next.set(payload.bin_id, {
        lat: existing?.lat,
        lng: existing?.lng,
        ...existing,
        ...payload,
      })
      return { bins: next }
    }),

  setBins: (bins) =>
    set(() => ({
      bins: new Map(bins.map((b) => [b.bin_id, b])),
    })),

  updateVehicle: (payload) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.set(payload.vehicle_id, payload)
      return { vehicles: next }
    }),

  removeVehicle: (vehicleId) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.delete(vehicleId)
      return { vehicles: next }
    }),

  updateZoneStats: (payload) =>
    set((state) => {
      const next = new Map(state.zoneStats)
      next.set(payload.zone_id, payload)
      return { zoneStats: next }
    }),

  selectBin: (binId) => set({ selectedBinId: binId }),

  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  getFilteredBins: () => {
    const { bins, filters } = get()
    return Array.from(bins.values()).filter((bin) => {
      if (filters.zoneId && bin.zone_id !== filters.zoneId) return false
      if (filters.status.length && !filters.status.includes(bin.status)) return false
      if (
        filters.wasteCategory.length &&
        !filters.wasteCategory.includes(bin.waste_category)
      ) return false
      return true
    })
  },
}))
```

### 7.3 Import updates required

After creating `mapStore.ts`, search and replace all `useBinStore` imports with `useMapStore` and all `useVehicleStore` imports with `useMapStore`. Update SocketProvider to use `mapStore` actions.

---

## 8. Sidebar & Navigation Updates

### 8.1 `src/components/layout/Sidebar.tsx` — update NAV_ITEMS

```typescript
import { Settings2 } from 'lucide-react' // add this import

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Overview',    href: '/dashboard' },
  { icon: Map,             label: 'Live Map',    href: '/dashboard/map' },
  { icon: Trash2,          label: 'Bins',        href: '/dashboard/bins' },
  { icon: Briefcase,       label: 'Jobs',        href: '/dashboard/jobs',       roles: ['supervisor', 'fleet-operator', 'admin'] },
  { icon: BarChart3,       label: 'Analytics',   href: '/dashboard/analytics',  roles: ['supervisor', 'admin'] },
  { icon: Settings2,       label: 'Operations',  href: '/dashboard/operations', roles: ['supervisor', 'admin'] },
  // Note: Fleet tab removed (vehicle positions visible on Live Map)
]
```

### 8.2 `src/components/layout/Topbar.tsx` — update PAGE_TITLES

```typescript
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Overview',
  '/dashboard/map':          'Live Map',
  '/dashboard/bins':         'Bins',
  '/dashboard/jobs':         'Collection Jobs',
  '/dashboard/analytics':    'Analytics',
  '/dashboard/operations':   'Operations',
  '/dashboard/history':      'History',
}
```

---

## 9. alertStore Updates

### 9.1 `src/store/alertStore.ts` — changes

1. Rename `dismissed` → `acknowledged`
2. Rename `dismissAlert(id)` → `acknowledgeAlert(id)` (also update all callsites)
3. Remove `'weight-limit'` from `type` union
4. Change `received_at: number` → `received_at: string` (ISO 8601)

```typescript
export interface Alert {
  id:           string
  type:         'urgent' | 'deviation' | 'escalated'
  bin_id?:      string
  job_id?:      string
  zone_id?:     number
  vehicle_id?:  string
  message:      string
  received_at:  string       // ISO 8601 from server
  acknowledged: boolean
}
```

---

## 10. New Shared Components

### 10.1 `src/components/shared/FillGauge.tsx`

Circular SVG gauge for bin fill level.

```typescript
interface FillGaugeProps {
  value:  number  // 0–100
  status: BinStatus
  size?:  number  // px, default 80
  label?: string  // shown below gauge, default "{value}%"
}
```

**Visual spec:**
- SVG circle with stroke-dasharray (circumference technique)
- Track ring: `stroke-muted` 8px width
- Fill arc: status colour 8px width
- Inner text: `{value}%` in `font-bold text-sm`
- Sub-label: status string in `text-xs text-muted-foreground`
- Animation: `stroke-dashoffset` CSS transition 600ms on mount

### 10.2 `src/components/shared/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status:  BinStatus
  size?:   'sm' | 'md'  // default 'md'
}
// Uses shadcn <Badge> with custom variant colours matching bin-* CSS variables
```

### 10.3 `src/components/shared/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'  // 16px / 24px / 32px
  label?: string              // sr-only accessible label
}
// Tailwind animate-spin circle border-2 border-border border-t-primary
```

### 10.4 `src/components/shared/ZoneSelector.tsx`

```typescript
interface ZoneSelectorProps {
  value:    number | null
  onChange: (zoneId: number | null) => void
  showAll?: boolean  // include "All zones" option, default true
}
// shadcn <Select> seeded with zones from useMapStore()
```

---

## 11. New Type Definitions

### 11.1 `src/types/cluster.ts` (new)

```typescript
export interface Cluster {
  cluster_id:         string
  cluster_name:       string
  lat:                number
  lng:                number
  zone_id:            number
  zone_name:          string
  bin_count:          number
  max_urgency_score:  number
  cluster_status:     'normal' | 'monitor' | 'urgent' | 'critical'
  total_weight_kg:    number
  urgent_bins:        number
}
```

### 11.2 `src/types/socket-events.ts` (new)

```typescript
// Canonical types for all Socket.IO event payloads
// Imported by SocketProvider and stores

export type { BinUpdatePayload as BinUpdateEvent }      from './bin'
export type { VehiclePositionPayload as VehiclePositionEvent } from './vehicle'

export interface ZoneStatsEvent {
  zone_id:            number
  zone_name:          string
  total_bins:         number
  urgent_bins:        number
  critical_bins:      number
  avg_fill_level_pct: number
  category_breakdown: Record<string, { count: number; total_kg: number }>
}

export interface JobCreatedEvent {
  job_id:             string
  job_type:           string
  zone_id:            number
  zone_name:          string
  state:              string
  assigned_vehicle_id: string | null
  assigned_driver_id: string | null
  total_bins:         number
  priority:           number
  route?: {
    waypoints: Array<{ lat: number; lng: number; cluster_id: string; bin_ids: string[] }>
  }
  created_at: string
}

export interface JobProgressEvent {
  job_id:           string
  bins_collected:   number
  bins_total:       number
  cargo_weight_kg:  number
  state:            string
}

export interface JobCompletedEvent {
  job_id:            string
  zone_id:           number
  vehicle_id:        string
  driver_id:         string
  bins_collected:    number   // bins_collected count
  bins_skipped:      number
  actual_weight_kg:  number   // NOT total_weight_kg
  duration_minutes:  number
  hyperledger_tx_id: string | null  // NOT blockchain_tx_id
  timestamp:         string   // ISO 8601 — NOT completed_at
}

export interface JobCancelledEvent {
  job_id:     string
  reason?:    string
  cancelled_at: string
}

export interface AlertUrgentEvent {
  bin_id:    string
  zone_id:   number
  message:   string
  urgency_score: number
}

export interface AlertDeviationEvent {
  vehicle_id: string
  job_id:     string
  zone_id:    number
  message:    string
  deviation_metres: number
}

export interface AlertEscalatedEvent {
  job_id:   string
  zone_id:  number
  message:  string
  reason:   string
}
```

---

## 12. API Layer Additions

### 12.1 `src/lib/api/zones.ts` (new)

```typescript
import type { KyInstance } from 'ky'
import type { Zone } from '@/types'

export const getZones = (api: KyInstance) =>
  api.get('api/v1/zones').json<Zone[]>()

export const getZoneSummary = (zoneId: number, api: KyInstance) =>
  api.get(`api/v1/zones/${zoneId}/summary`).json()
```

Remove `getZoneSummary` from `src/lib/api/bins.ts`.

### 12.2 `src/lib/api/drivers.ts` (new)

```typescript
import type { KyInstance } from 'ky'
import type { Driver } from '@/types/vehicle'

export const getDrivers = (api: KyInstance, params?: { zone_id?: number; status?: string }) =>
  api.get('api/v1/drivers', { searchParams: params as Record<string, string> }).json<Driver[]>()

export const createDriver = (api: KyInstance, body: Omit<Driver, 'driver_id' | 'status'>) =>
  api.post('api/v1/drivers', { json: body }).json<Driver>()

export const updateDriver = (api: KyInstance, driverId: string, body: Partial<Driver>) =>
  api.patch(`api/v1/drivers/${driverId}`, { json: body }).json<Driver>()
```

### 12.3 `src/lib/api/jobs.ts` — additions

> **Note on `getJobStats`:** There is no `/api/v1/collection-jobs/stats` endpoint in Kong or the orchestrator codebase. Analytics aggregate data must be derived client-side from the standard `getJobs()` paginated response, or this endpoint needs to be added to the orchestrator and Kong config first. **Do not call a non-existent endpoint.** The `CollectionEfficiencyChart` and `VehicleUtilisationChart` components should derive their data from the jobs list with date filtering until a stats endpoint exists.

> **Note on `getJobProgress`:** The correct Kong-exposed path is `/api/v1/collections` (scheduler-service), not `/api/v1/jobs`. The progress detail route is served by the scheduler.

```typescript
// api/v1/collections/:job_id/progress — served by scheduler-service via Kong /api/v1/collections
export const getJobProgress = (
  api: KyInstance,
  jobId: string,
) => api.get(`api/v1/collections/${jobId}/progress`).json<JobProgress>()
```

### 12.4 `src/lib/api/ml.ts` — addition

> **Verify before calling:** `api/v1/ml/predict/zone-generation` is not in the existing `ml.ts` and is not explicitly documented in the ML service spec. Confirm the endpoint exists (check `Smart-Waste-Management-Docs/05-route-optimizer.md` and the FastAPI service routes) before implementing `ZoneForecastChart`. If unavailable, display an "endpoint not yet available" empty state.

```typescript
export const getZoneForecast = (
  api: KyInstance,
  params: { zone_id: number; date_range: string },
) => api.get('api/v1/ml/predict/zone-generation', {
  searchParams: params as Record<string, string>,
}).json<ZoneForecastData>()  // define ZoneForecastData type once endpoint contract is confirmed
```

---

## 13. SocketProvider Updates

**File:** `src/components/providers/SocketProvider.tsx`

Changes required (minimal — architecture unchanged):

1. Replace `useBinStore` / `useVehicleStore` with `useMapStore`
2. Remove `alert:weight-limit` handler and its cleanup
3. Keep `updateJobProgress(payload)` for `job:progress` events — `JobDetailDrawer` reads from `jobStore.jobProgress` Map
4. Add `removeVehicle(event.vehicle_id)` call in `job:completed` handler

```typescript
// Replace store imports:
import { useMapStore } from '@/store/mapStore'
// Remove: import { useBinStore }, import { useVehicleStore }

// In the store action destructure:
const updateBin     = useMapStore((s) => s.updateBin)
const updateZone    = useMapStore((s) => s.updateZoneStats)
const updateVehicle = useMapStore((s) => s.updateVehicle)
const removeVehicle = useMapStore((s) => s.removeVehicle)

// job:completed handler — use exact JobCompletedEvent field names (see §11.2):
sock.on('job:completed', (e: JobCompletedEvent) => {
  updateJob(e.job_id, { state: 'COMPLETED', actual_weight_kg: e.actual_weight_kg })
  removeVehicle(e.vehicle_id)  // remove vehicle marker when job done
})

// job:progress handler — keep updateJobProgress (DO NOT change to updateJob):
// JobDetailDrawer reads from jobStore.jobProgress Map (keyed by job_id).
// Changing this to updateJob(e.job_id, e) would leave jobProgress empty.
sock.on('job:progress', (e) => updateJobProgress(e))

// Remove this handler entirely (weight-limit alert type no longer exists):
// sock.on('alert:weight-limit', ...)
// sock.off('alert:weight-limit') in cleanup
```

---

## 14. Complete File Change List

### Files to DELETE
```
src/components/map/MapInner.tsx
src/components/map/CityMap.tsx
src/store/binStore.ts
src/store/vehicleStore.ts
src/store/__tests__/binStore.test.ts     ← replaced by mapStore.test.ts
src/app/dashboard/fleet/                ← entire directory
```

### Files to CREATE
```
src/lib/mapbox.ts
src/lib/colours.ts                        ← ZONE_COLOURS, STATUS_COLORS constants (see §0 below)
src/lib/api/zones.ts
src/lib/api/drivers.ts
src/store/mapStore.ts
src/types/cluster.ts
src/types/socket-events.ts

src/components/map/DashboardMap.tsx
src/components/map/ClusterMarker.tsx
src/components/map/BinMarker.tsx
src/components/map/VehicleMarker.tsx
src/components/map/RoutePolyline.tsx
src/components/map/ZoneOverlay.tsx
src/components/map/BinDetailPanel.tsx

src/components/layout/NotificationList.tsx

src/components/jobs/JobDetailDrawer.tsx
src/components/jobs/JobStateBadge.tsx
src/components/jobs/JobTypeBadge.tsx
src/components/jobs/JobProgressBar.tsx
src/components/jobs/BinStopList.tsx
src/components/jobs/StateTimeline.tsx

src/components/analytics/ZoneFillTrendsChart.tsx
src/components/analytics/WasteCategoryChart.tsx
src/components/analytics/FillRateHeatmap.tsx
src/components/analytics/CollectionEfficiencyChart.tsx
src/components/analytics/VehicleUtilisationChart.tsx
src/components/analytics/ZoneForecastChart.tsx
src/components/analytics/ChartSkeleton.tsx
src/components/analytics/ChartCard.tsx

src/components/shared/FillGauge.tsx
src/components/shared/ZoneSelector.tsx
src/components/shared/StatusBadge.tsx
src/components/shared/LoadingSpinner.tsx
src/components/shared/AlertBanner.tsx

src/app/dashboard/operations/page.tsx
src/app/dashboard/operations/_components/OperationsClient.tsx
src/app/dashboard/operations/_components/BinsTab.tsx
src/app/dashboard/operations/_components/VehiclesTab.tsx
src/app/dashboard/operations/_components/DriversTab.tsx
src/app/dashboard/operations/_components/AccountsTab.tsx
src/app/dashboard/operations/_components/BinFormDialog.tsx
src/app/dashboard/operations/_components/VehicleFormDialog.tsx
src/app/dashboard/operations/_components/DriverFormDialog.tsx
src/app/dashboard/operations/_components/AccountFormDialog.tsx

src/store/__tests__/mapStore.test.ts      ← replaces binStore.test.ts

src/app/api/admin/accounts/route.ts   ← server-side Keycloak admin proxy

dashboard/.env.local.example
```

### Files to MODIFY
```
package.json                            ← uninstall leaflet/react-leaflet, install mapbox-gl
tailwind.config.ts                      ← add job state colours
src/types/vehicle.ts                    ← add email, phone, license_no, registration, year fields to Driver + Vehicle
src/store/alertStore.ts                 ← dismissed→acknowledged, remove weight-limit
src/store/jobStore.ts                   ← add completeJob(), removeJob()
src/components/providers/SocketProvider.tsx  ← use mapStore, remove weight-limit
src/components/layout/AlertBell.tsx     ← replace with Popover dropdown
src/components/layout/Sidebar.tsx       ← add Operations nav item, remove Fleet
src/components/layout/Topbar.tsx        ← update PAGE_TITLES, add /operations
src/mocks/MockSocketInjector.tsx        ← update useBinStore/useVehicleStore → useMapStore
src/app/dashboard/_components/OverviewClient.tsx  ← add mini-map, use mapStore
src/app/dashboard/page.tsx             ← update to use mapStore
src/app/dashboard/map/page.tsx         ← replace CityMap with DashboardMap
src/app/dashboard/jobs/page.tsx        ← add JobDetailDrawer, click handler
src/app/dashboard/analytics/page.tsx   ← replace inline charts with chart components
src/lib/api/bins.ts                    ← add getCluster(), remove getZoneSummary()
src/lib/api/jobs.ts                    ← add getJobProgress() (getJobStats removed — see §12.3)
src/lib/api/ml.ts                      ← add getZoneForecast() (verify endpoint first)
```

---

## 15. Implementation Order

Implement in this order to keep the app buildable at each step:

| Step | What | Unblocks |
|------|------|----------|
| 1 | Create `mapStore.ts`, update all imports | All map + store work |
| 2 | Update `SocketProvider.tsx` | Real-time data flows to mapStore |
| 3 | Update `alertStore.ts` | Notification dropdown |
| 4 | Create `lib/mapbox.ts` | Map components |
| 5 | Create `DashboardMap.tsx` + sub-components | Map page |
| 6 | Update `map/page.tsx` | Map page live |
| 7 | Update `AlertBell.tsx` → dropdown | Notifications working |
| 8 | Add mini-map to `OverviewClient.tsx` | Overview with map |
| 9 | Create `JobDetailDrawer.tsx` + sub-components | Jobs drawer |
| 10 | Update `jobs/page.tsx` | Jobs page with drawer |
| 11 | Create analytics chart components | Analytics improved |
| 12 | Update `analytics/page.tsx` | Analytics live |
| 13 | Create `operations/` page + sub-components | Operations tab |
| 14 | Update `Sidebar.tsx` + `Topbar.tsx` | Nav complete |
| 15 | Add `tailwind.config.ts` job colours | Correct badge colours |
| 16 | Delete legacy files (Leaflet, fleet, old stores) | Clean build |

---

## 16. Testing Requirements

Following `dashboard-testing.instructions.md` patterns:

### Unit tests to add
- `mapStore.test.ts` — updateBin preserves lat/lng, getFilteredBins filter logic, selectZone sets selectedZoneId
- `alertStore.test.ts` — acknowledgeAlert, no weight-limit type
- `FillGauge.test.tsx` — renders correct arc for given fill value
- `NotificationList.test.tsx` — renders alert items, dismiss action

### Mock data updates required
Before any component tests run:
- `src/mocks/handlers.ts` — add MSW handlers for all new Kong routes:
  - `GET /api/v1/zones`
  - `GET /api/v1/drivers`, `POST /api/v1/drivers`, `PATCH /api/v1/drivers/:id`
  - `GET /api/v1/bins/:id/history` (for BinDetailPanel 7-day chart)
  - `GET /api/v1/collections/:id/progress` (for JobDetailDrawer progress)
  - `POST /api/admin/accounts` (Keycloak proxy)
- `src/mocks/MockSocketInjector.tsx` — update to import `useMapStore` instead of `useBinStore` / `useVehicleStore`. All injected socket payloads must call `updateBin`, `updateVehicle`, `updateZoneStats` on `useMapStore`.
- Update existing MSW bin/vehicle/job handlers to produce payloads that match the types in `src/types/socket-events.ts` (i.e. use `actual_weight_kg`, `hyperledger_tx_id`, `timestamp` — not the old field names)

> **Tip:** Missing MSW handlers cause ky requests to return a 404 from the service worker, which `useQuery` treats as an error — the component silently shows its error state. Always check the browser console for `[MSW] unhandled GET /api/v1/...` warnings when adding new API calls.

### E2E tests to add (Playwright)
- `map.spec.ts` — map loads, fallback to UoM on missing token, bin click opens panel
- `jobs-drawer.spec.ts` — click job card → drawer opens with route map
- `operations.spec.ts` — add bin form validation, success toast

---

*End of spec.*
