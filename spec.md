# Next.js Dashboard — Complete Build Specification
# Smart Waste Management System — F3 Group
# Version 1.0

---

## Table of Contents

1. [What You Are Building](#1-what-you-are-building)
2. [How the Dashboard Fits in the System](#2-how-the-dashboard-fits-in-the-system)
3. [Tech Stack](#3-tech-stack)
4. [Project Setup from Scratch](#4-project-setup-from-scratch)
5. [Environment Variables](#5-environment-variables)
6. [Authentication — Keycloak via NextAuth](#6-authentication--keycloak-via-nextauth)
7. [API Layer — Connecting to Backend Services](#7-api-layer--connecting-to-backend-services)
8. [Real-Time Layer — Socket.IO Integration](#8-real-time-layer--socketio-integration)
9. [Global State — Zustand Stores](#9-global-state--zustand-stores)
10. [File & Folder Structure](#10-file--folder-structure)
11. [Pages to Build](#11-pages-to-build)
12. [Component Library](#12-component-library)
13. [Type Definitions](#13-type-definitions)
14. [Running Locally](#14-running-locally)
15. [Testing](#15-testing)
16. [Docker & Deployment](#16-docker--deployment)
17. [End-to-End Integration Checklist](#17-end-to-end-integration-checklist)
18. [Common Pitfalls](#18-common-pitfalls)

---

## 1. What You Are Building

The Next.js dashboard is the **supervisor and fleet operator interface** for the Smart Waste Management System. It is a real-time web application that shows:

- Live fill levels for every bin across all city zones
- Active collection jobs (routine and emergency) with their current state
- Real-time vehicle positions on a map
- Alerts when bins hit urgency threshold with no collection scheduled
- Analytics: fill trends, waste generation patterns, ML predictions

**Who uses it:** Supervisors (per-zone view) and Fleet Operators (all zones). Drivers use the Flutter app — not this dashboard.

**Your role in the group:** You are F3. The backend services (Bin Status Service, Workflow Orchestrator, Scheduler Service, Notification Service) are also F3 — your teammates are building them. You consume their APIs and their Socket.IO events.

---

## 2. How the Dashboard Fits in the System

### Data flow to the dashboard

```
ESP32 Sensor
  └─► EMQX (MQTT) ─► Kafka: waste.bin.telemetry
                          └─► Flink Processor
                                 ├─► Kafka: waste.bin.processed
                                 │       └─► Bin Status Service
                                 │               ├─► Kafka: waste.bin.dashboard.updates
                                 │               └─► REST API (Kong)
                                 └─► Kafka: waste.zone.statistics
                                             └─► Bin Status Service
                                                     └─► Kafka: waste.bin.dashboard.updates

Flutter Driver App
  └─► Kafka: waste.vehicle.location
         └─► Scheduler Service
                 ├─► Kafka: waste.vehicle.dashboard.updates
                 └─► REST API (Kong)

Orchestrator (job lifecycle)
  └─► POST /internal/notify/job-created
  └─► POST /internal/notify/job-escalated
  └─► POST /internal/notify/job-completed
  └─► POST /internal/notify/job-cancelled
         └─► Notification Service
                 └─► Socket.IO ──► YOUR NEXT.JS DASHBOARD
```

### Your two data sources

**1. REST APIs** (initial page loads, on-demand fetches) — all routed through Kong API Gateway at `NEXT_PUBLIC_API_BASE_URL`.

**2. Socket.IO** (real-time updates) — connects **through Kong** (`/ws` route) to the Notification Service at `NEXT_PUBLIC_SOCKET_URL`. You send your Keycloak JWT as `handshake.auth.token` and the server auto-joins you to the right rooms based on your role.

---

## 3. Tech Stack

```
Framework:       Next.js 14+ (App Router)
Language:        TypeScript (strict)
Styling:         Tailwind CSS
Auth:            NextAuth.js v5 with Keycloak provider
Data fetching:   TanStack Query v5 (REST cache + background refetch)
Real-time:       socket.io-client v4
Global state:    Zustand v4
Map:             Leaflet + react-leaflet (no API key needed)
Charts:          Recharts
UI components:   shadcn/ui (Radix primitives + Tailwind)
Forms:           react-hook-form + zod
Date handling:   date-fns
HTTP client:     ky (typed fetch wrapper — lighter than axios)
```

---

## 4. Project Setup from Scratch

### 4.1 Create the Next.js app

Run this inside `Smart-Waste-Management-System-Application/`:

```bash
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd dashboard
```

### 4.2 Install all dependencies

```bash
# Auth
npm install next-auth@beta

# Data fetching and state
npm install @tanstack/react-query zustand

# Real-time
npm install socket.io-client

# HTTP client
npm install ky

# Map
npm install leaflet react-leaflet
npm install -D @types/leaflet

# Charts
npm install recharts

# UI (shadcn setup — run this then add components as needed)
npx shadcn@latest init
# Choose: Default style, Slate base color, CSS variables: yes

# Add shadcn components you will use
npx shadcn@latest add card badge button table tabs dialog alert
npx shadcn@latest add sheet skeleton tooltip separator scroll-area

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Date utilities
npm install date-fns

# Dev tools
npm install -D @tanstack/react-query-devtools
```

### 4.3 Tailwind config — add custom colors matching the system

Add to `tailwind.config.ts`:

```typescript
extend: {
  colors: {
    bin: {
      normal:   '#22c55e',   // green-500
      monitor:  '#eab308',   // yellow-500
      urgent:   '#f97316',   // orange-500
      critical: '#ef4444',   // red-500
      offline:  '#6b7280',   // gray-500
    },
    waste: {
      food_waste: '#8B4513',
      paper:      '#4169E1',
      glass:      '#228B22',
      plastic:    '#FF6347',
      general:    '#808080',
      e_waste:    '#FFD700',
    }
  }
}
```

---

## 5. Environment Variables

Create `dashboard/.env.local`:

```env
# Kong API Gateway — all REST calls go through here (NodePort 30080)
NEXT_PUBLIC_API_BASE_URL=http://localhost:30080

# Socket.IO connects through Kong /ws route (NodePort 30080)
NEXT_PUBLIC_SOCKET_URL=http://localhost:30080

# Keycloak (via NextAuth) — clientId and secret from realm-export.json
AUTH_KEYCLOAK_ID=swms-dashboard
AUTH_KEYCLOAK_SECRET=dashboard-client-secret-dev
AUTH_KEYCLOAK_ISSUER=http://localhost:30180/realms/waste-management

# NextAuth secret (generate with: openssl rand -base64 32)
AUTH_SECRET=<generate-this>

# App URL
NEXTAUTH_URL=http://localhost:3000
```

Create `dashboard/.env.example` with the same keys but empty values — commit this, not `.env.local`.

---

## 6. Authentication — Keycloak via NextAuth

### 6.1 `src/auth.ts` — NextAuth configuration

```typescript
import NextAuth from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId:     process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer:       process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    // Attach the raw Keycloak access token to the session so you can
    // pass it to Kong and to Socket.IO
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      // Pull Keycloak custom attributes into session
      const decoded = decodeJwt(token.accessToken as string)
      session.user.role = decoded.realm_access?.roles?.[0] ?? 'viewer'
      session.user.zoneId = decoded.zone_id ?? null
      return session
    },
  },
})

// Simple JWT decode (no verification — Kong/backend verifies)
function decodeJwt(token: string) {
  const base64 = token.split('.')[1]
  return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')))
}
```

### 6.2 `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

### 6.3 `src/middleware.ts` — protect all dashboard routes

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Drivers use the Flutter app — redirect them if they somehow land on the dashboard
  const role = req.auth?.user?.role
  if (role === 'driver' && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }
})

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

### 6.4 `src/app/login/page.tsx`

```tsx
import { signIn } from '@/auth'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form action={async () => { 'use server'; await signIn('keycloak') }}>
        <button type="submit" className="...">
          Sign in with Keycloak
        </button>
      </form>
    </div>
  )
}
```

### 6.5 Extend NextAuth types — `src/types/next-auth.d.ts`

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    user: {
      name?: string | null
      email?: string | null
      role: 'supervisor' | 'fleet-operator' | 'viewer'
      zoneId: number | null
    }
  }
}
```

---

## 7. API Layer — Connecting to Backend Services

### 7.1 `src/lib/api-client.ts` — base HTTP client

```typescript
import ky from 'ky'
import { auth } from '@/auth'

// Server-side fetch with auth token injected
export async function createApiClient() {
  const session = await auth()
  const token = session?.accessToken

  return ky.create({
    prefixUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 10_000,
  })
}

// Client-side fetch — reads token from session via /api/session
export function createClientApiClient(token: string) {
  return ky.create({
    prefixUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000,
  })
}
```

### 7.2 API functions — grouped by service

Create `src/lib/api/` with one file per service.

#### `src/lib/api/bins.ts`

```typescript
import type { KyInstance } from 'ky'
import type { Bin, BinHistory, ZoneSummary } from '@/types'

// All functions take a pre-configured ky instance as the first argument.
// Server Components pass: await createApiClient()
// Client Components pass: createClientApiClient(session.accessToken)
// This keeps server-only code (auth()) out of client bundles entirely.

export async function getBins(api: KyInstance, params?: {
  zone_id?: number
  status?: string
  waste_category?: string
  page?: number
  limit?: number
}) {
  return api.get('api/v1/bins', { searchParams: params ?? {} }).json<{
    data: Bin[]
    total: number
    page: number
    limit: number
  }>()
}

export async function getBin(api: KyInstance, binId: string) {
  return api.get(`api/v1/bins/${binId}`).json<Bin>()
}

export async function getBinHistory(api: KyInstance, binId: string) {
  return api.get(`api/v1/bins/${binId}/history`).json<BinHistory>()
}

export async function getZoneSummary(api: KyInstance, zoneId: number) {
  return api.get(`api/v1/zones/${zoneId}/summary`).json<ZoneSummary>()
}
```

#### `src/lib/api/jobs.ts`

```typescript
import type { KyInstance } from 'ky'
import type { CollectionJobListItem, CollectionJobDetail } from '@/types'

export async function getJobs(api: KyInstance, params?: {
  state?: string
  job_type?: string
  zone_id?: number
  page?: number
  limit?: number
}) {
  return api.get('api/v1/collection-jobs', { searchParams: params ?? {} }).json<{
    data: CollectionJobListItem[]
    total: number
    page: number
  }>()
}

export async function getJob(api: KyInstance, jobId: string) {
  return api.get(`api/v1/collection-jobs/${jobId}`).json<CollectionJobDetail>()
}

export async function cancelJob(api: KyInstance, jobId: string, reason: string) {
  return api.post(`api/v1/collection-jobs/${jobId}/cancel`, { json: { reason } }).json()
}
```

#### `src/lib/api/vehicles.ts`

```typescript
import type { KyInstance } from 'ky'
import type { ActiveVehicle } from '@/types'

export async function getActiveVehicles(api: KyInstance) {
  return api.get('api/v1/vehicles/active').json<{ vehicles: ActiveVehicle[] }>()
}

// NOTE: GET /api/v1/jobs/:id/progress and GET /api/v1/drivers/available are
// scheduler-service endpoints that are NOT routed through Kong.
// Job progress is delivered in real-time via the job:progress Socket.IO event.
// Available drivers are an internal scheduler concern — not exposed to the dashboard.
```

#### `src/lib/api/ml.ts`

```typescript
import type { KyInstance } from 'ky'

export async function getWasteGenerationTrends(api: KyInstance, params: {
  zone_id?: number
  days?: number
}) {
  return api.get('api/v1/ml/trends/waste-generation', { searchParams: params }).json()
}

export async function getFillTimePrediction(api: KyInstance, binId: string) {
  return api.get('api/v1/ml/predict/fill-time', {
    searchParams: { bin_id: binId }
  }).json()
}
```

### 7.3 How to call API functions — Server vs Client

Because all api/ functions now take a `KyInstance` argument, calling them is explicit about which side of the fence you are on:

**In a Server Component (SSR initial data fetch):**
```typescript
import { createApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'

export default async function BinsPage() {
  const api = await createApiClient()          // server-only — calls auth() internally
  const initialData = await getBins(api)
  return <BinTable initialData={initialData} />
}
```

**In a Client Component (TanStack Query for background refetch):**
```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'

export function BinTable({ initialData }: { initialData: ... }) {
  const { data: session } = useSession()

  const { data } = useQuery({
    queryKey: ['bins'],
    queryFn: () => getBins(createClientApiClient(session!.accessToken)),
    initialData,
    enabled: !!session?.accessToken,
  })
  // ...
}
```

**In `src/hooks/` (recommended — encapsulate the pattern):**
```typescript
// src/hooks/useBins.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getBins } from '@/lib/api/bins'
import type { Bin } from '@/types'

export function useBins(params?: { zone_id?: number; status?: string }) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: ['bins', params],
    queryFn: () => getBins(createClientApiClient(session!.accessToken), params),
    enabled: !!session?.accessToken,
    staleTime: 30_000,
  })
}
```
Follow the same pattern for `useJobs`, `useVehicles`.

### 7.4 TanStack Query setup

`src/app/providers.tsx`:

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,          // data is fresh for 30s
        refetchOnWindowFocus: true,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  )
}
```

Wrap `src/app/layout.tsx` body with `<Providers>`.

---

## 8. Real-Time Layer — Socket.IO Integration

### 8.1 `src/lib/socket.ts` — singleton socket client

```typescript
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    auth: { token },                       // Keycloak JWT — required
    path: '/ws/socket.io',                 // Kong routes /ws → notification-service
    transports: ['websocket', 'polling'], // websocket first, polling fallback
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket.IO] connect error:', err.message)
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
```

### 8.2 `src/components/providers/SocketProvider.tsx` — React context

```tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { type Socket } from 'socket.io-client'
import { getSocket } from '@/lib/socket'
import { useSession } from 'next-auth/react'
import { useBinStore } from '@/store/binStore'
import { useVehicleStore } from '@/store/vehicleStore'
import { useAlertStore } from '@/store/alertStore'
import { useJobStore } from '@/store/jobStore'

const SocketContext = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  // useState (not useRef) — state change triggers re-render so consumers of
  // useSocket() receive the live socket instance once it connects, not null.
  const [socket, setSocket] = useState<Socket | null>(null)

  const updateBin     = useBinStore((s) => s.updateBin)
  const updateZone    = useBinStore((s) => s.updateZone)
  const updateVehicle = useVehicleStore((s) => s.updateVehicle)
  const addAlert      = useAlertStore((s) => s.addAlert)
  const updateJob     = useJobStore((s) => s.updateJob)
  const addJob        = useJobStore((s) => s.addJob)
  const updateJobProgress = useJobStore((s) => s.updateJobProgress)

  useEffect(() => {
    if (!session?.accessToken) return

    const sock = getSocket(session.accessToken)
    setSocket(sock)  // triggers re-render → consumers get the real socket

    // ── Bin and zone events (from Bin Status Service via Kafka) ──
    sock.on('bin:update',  (payload) => updateBin(payload))
    sock.on('zone:stats',  (payload) => updateZone(payload))
    sock.on('alert:urgent',(payload) => addAlert({ ...payload, type: 'urgent' }))

    // ── Vehicle events (from Scheduler Service via Kafka) ──────
    sock.on('vehicle:position', (payload) => updateVehicle(payload))
    sock.on('job:progress',     (payload) => updateJobProgress(payload))

    // ── Job lifecycle events (from Orchestrator via HTTP) ──────
    sock.on('job:created',   (payload) => addJob(payload))
    sock.on('job:completed', (payload) => updateJob(payload.job_id, { state: 'COMPLETED', ...payload }))
    sock.on('job:cancelled', (payload) => updateJob(payload.job_id, { state: 'CANCELLED', ...payload }))
    sock.on('alert:escalated', (payload) => addAlert({ ...payload, type: 'escalated' }))

    // ── Alert events (from Scheduler via HTTP) ─────────────────
    sock.on('alert:deviation',    (payload) => addAlert({ ...payload, type: 'deviation' }))
    sock.on('alert:weight-limit', (payload) => addAlert({ ...payload, type: 'weight-limit' }))

    return () => {
      sock.off('bin:update')
      sock.off('zone:stats')
      sock.off('alert:urgent')
      sock.off('vehicle:position')
      sock.off('job:progress')
      sock.off('job:created')
      sock.off('job:completed')
      sock.off('job:cancelled')
      sock.off('alert:escalated')
      sock.off('alert:deviation')
      sock.off('alert:weight-limit')
    }
  }, [session?.accessToken])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
```

Add `<SocketProvider>` inside `<SessionProvider>` in your `providers.tsx`.

---

## 9. Global State — Zustand Stores

### 9.1 `src/store/binStore.ts`

Holds live bin states and zone stats — updated by Socket.IO events.

```typescript
import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload } from '@/types'

interface BinStore {
  bins: Map<string, BinUpdatePayload>
  zones: Map<number, ZoneStatsPayload>
  updateBin:  (payload: BinUpdatePayload) => void
  updateZone: (payload: ZoneStatsPayload) => void
  setBins:    (bins: BinUpdatePayload[]) => void  // called on initial REST load
}

export const useBinStore = create<BinStore>((set) => ({
  bins:  new Map(),
  zones: new Map(),

  updateBin: (payload) =>
    set((state) => {
      const next = new Map(state.bins)
      next.set(payload.bin_id, payload)
      return { bins: next }
    }),

  updateZone: (payload) =>
    set((state) => {
      const next = new Map(state.zones)
      next.set(payload.zone_id, payload)
      return { zones: next }
    }),

  setBins: (bins) =>
    set(() => ({
      bins: new Map(bins.map((b) => [b.bin_id, b])),
    })),
}))
```

### 9.2 `src/store/vehicleStore.ts`

```typescript
import { create } from 'zustand'
import type { VehiclePositionPayload } from '@/types'

interface VehicleStore {
  vehicles: Map<string, VehiclePositionPayload>
  updateVehicle: (payload: VehiclePositionPayload) => void
  setVehicles:   (vehicles: VehiclePositionPayload[]) => void
}

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicles: new Map(),

  updateVehicle: (payload) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.set(payload.vehicle_id, payload)
      return { vehicles: next }
    }),

  setVehicles: (list) =>
    set(() => ({
      vehicles: new Map(list.map((v) => [v.vehicle_id, v])),
    })),
}))
```

### 9.3 `src/store/alertStore.ts`

```typescript
import { create } from 'zustand'

export interface Alert {
  id:        string
  type:      'urgent' | 'escalated' | 'deviation' | 'weight-limit'
  bin_id?:   string
  job_id?:   string
  zone_id?:  number    // optional — not present on weight-limit alerts
  message:   string
  received_at: number   // Date.now()
  dismissed: boolean
}

interface AlertStore {
  alerts: Alert[]
  addAlert:     (payload: Omit<Alert, 'id' | 'received_at' | 'dismissed'>) => void
  dismissAlert: (id: string) => void
  clearAll:     () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],

  addAlert: (payload) =>
    set((state) => ({
      alerts: [
        { ...payload, id: crypto.randomUUID(), received_at: Date.now(), dismissed: false },
        ...state.alerts.slice(0, 49),   // keep last 50
      ],
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => a.id === id ? { ...a, dismissed: true } : a),
    })),

  clearAll: () => set({ alerts: [] }),
}))
```

### 9.4 `src/store/jobStore.ts`

```typescript
import { create } from 'zustand'
import type { CollectionJob, JobProgress } from '@/types'

interface JobStore {
  jobs:        Map<string, CollectionJob>
  jobProgress: Map<string, JobProgress>   // live job progress keyed by job_id
  addJob:      (job: CollectionJob) => void
  updateJob:   (jobId: string, patch: Partial<CollectionJob>) => void
  setJobs:     (jobs: CollectionJob[]) => void
  setJobsFromList: (jobs: import('@/types').CollectionJobListItem[]) => void  // maps REST list (uses .id)
  updateJobProgress: (payload: JobProgress) => void  // from job:progress socket event
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: new Map(),
  jobProgress: new Map(),

  addJob: (job) =>
    set((state) => {
      const next = new Map(state.jobs)
      next.set(job.job_id, job)
      return { jobs: next }
    }),

  updateJob: (jobId, patch) =>
    set((state) => {
      const existing = state.jobs.get(jobId)
      if (!existing) return state
      const next = new Map(state.jobs)
      next.set(jobId, { ...existing, ...patch })
      return { jobs: next }
    }),

  setJobs: (list) =>
    set(() => ({
      jobs: new Map(list.map((j) => [j.job_id, j])),
    })),

  setJobsFromList: (list) =>
    set(() => ({
      // REST GET /api/v1/collection-jobs returns CollectionJobListItem with .id (not .job_id)
      jobs: new Map(list.map((j) => [j.id, j as unknown as CollectionJob])),
    })),

  updateJobProgress: (payload) =>
    set((state) => {
      const next = new Map(state.jobProgress)
      next.set(payload.job_id, payload)
      return { jobProgress: next }
    }),
}))
```

---

## 10. File & Folder Structure

```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout — wraps with Providers
│   │   ├── providers.tsx               # QueryClient + Session + Socket providers
│   │   ├── login/
│   │   │   └── page.tsx                # Keycloak sign-in button
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/
│   │   │       └── route.ts            # NextAuth handler
│   │   └── dashboard/
│   │       ├── layout.tsx              # Sidebar + topbar shell
│   │       ├── page.tsx                # Overview — zone cards + alert feed
│   │       ├── map/
│   │       │   └── page.tsx            # Live city map
│   │       ├── bins/
│   │       │   ├── page.tsx            # Bin status table
│   │       │   └── [id]/
│   │       │       └── page.tsx        # Single bin detail
│   │       ├── jobs/
│   │       │   ├── page.tsx            # Jobs list (tabs: active/completed/escalated)
│   │       │   └── [id]/
│   │       │       └── page.tsx        # Job detail + state machine view
│   │       ├── fleet/
│   │       │   └── page.tsx            # Active vehicles + drivers
│   │       └── analytics/
│   │           └── page.tsx            # Charts and ML predictions
│   ├── components/
│   │   ├── providers/
│   │   │   └── SocketProvider.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── AlertBell.tsx
│   │   ├── map/
│   │   │   ├── CityMap.tsx             # Main Leaflet map (Client Component)
│   │   │   ├── BinMarker.tsx           # Colored circle per bin
│   │   │   ├── VehicleMarker.tsx       # Truck icon with heading
│   │   │   ├── RoutePolyline.tsx       # Draws waypoints as route line
│   │   │   └── BinPopup.tsx            # Click popup with bin detail
│   │   ├── bins/
│   │   │   ├── BinStatusBadge.tsx      # normal/monitor/urgent/critical badge
│   │   │   ├── BinCard.tsx
│   │   │   ├── BinTable.tsx
│   │   │   └── FillLevelChart.tsx      # History chart (Recharts)
│   │   ├── jobs/
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobStateBadge.tsx
│   │   │   ├── JobStateStepper.tsx     # Visual state machine progress
│   │   │   └── JobWaypointList.tsx
│   │   ├── fleet/
│   │   │   ├── VehicleCard.tsx
│   │   │   └── CargoBar.tsx            # Cargo utilisation progress bar
│   │   ├── analytics/
│   │   │   ├── ZoneFillChart.tsx
│   │   │   └── WasteBreakdownChart.tsx
│   │   └── shared/
│   │       ├── StatCard.tsx            # Number + label + trend card
│   │       ├── ZoneCard.tsx            # Zone fill level overview card
│   │       └── AlertFeed.tsx           # Scrollable alert list
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── socket.ts
│   │   ├── auth.ts                     # NextAuth config
│   │   └── api/
│   │       ├── bins.ts
│   │       ├── jobs.ts
│   │       ├── vehicles.ts
│   │       └── ml.ts
│   ├── store/
│   │   ├── binStore.ts
│   │   ├── vehicleStore.ts
│   │   ├── alertStore.ts
│   │   └── jobStore.ts
│   ├── types/
│   │   ├── index.ts                    # Re-exports all types
│   │   ├── bin.ts
│   │   ├── job.ts
│   │   ├── vehicle.ts
│   │   └── next-auth.d.ts
│   ├── hooks/
│   │   ├── useBins.ts                  # TanStack Query hook for bins
│   │   ├── useJobs.ts
│   │   ├── useVehicles.ts
│   │   └── useAlerts.ts
│   ├── auth.ts                         # NextAuth exports
│   └── middleware.ts                   # Route protection
├── public/
│   └── icons/
│       ├── truck.svg
│       └── bin.svg
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 11. Pages to Build

### Page 1: `/dashboard` — Overview

**Purpose:** First thing supervisors see. Summary of the entire system right now.

**Initial data (SSR):** Fetch zone summaries for all zones on the server.

**Layout:**
```
Row 1: Stat Cards
  [Total Bins]  [Urgent/Critical Bins]  [Active Jobs]  [Vehicles On Road]

Row 2: Zone Cards (one card per zone)
  Zone name | Avg fill % (progress bar) | Urgent bin count | Active jobs badge
  Live-updated by zone:stats Socket.IO events

Row 3: Two columns
  Left:  Recent Alerts feed (last 20 alert:urgent events from alertStore)
  Right: Active Jobs list (top 5, linked to /dashboard/jobs)
```

**Key implementation detail:** Zone cards read from `useBinStore((s) => s.zones)`. Since the store is populated by Socket.IO, zone cards update in real-time without polling.

---

### Page 2: `/dashboard/map` — Live City Map

**Purpose:** Spatial view of all bins and vehicles. Most visually important page.

**This must be a Client Component** (`'use client'`) because Leaflet requires the browser DOM.

**Implementation steps:**

**Step 1 — Leaflet setup.** Leaflet has a known issue with Next.js — fix it:

```tsx
// components/map/CityMap.tsx
'use client'
import dynamic from 'next/dynamic'

// Use dynamic import with ssr: false to prevent SSR errors
const MapWithNoSSR = dynamic(
  () => import('./MapInner'),
  { ssr: false, loading: () => <div className="h-full bg-gray-100 animate-pulse" /> }
)

export function CityMap() {
  return <MapWithNoSSR />
}
```

```tsx
// components/map/MapInner.tsx — the actual Leaflet map
'use client'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
// ... rest of map
```

**Step 2 — Bin markers.** Read from `useBinStore((s) => s.bins)`. Color each marker by `status`:

```tsx
const statusColors = {
  normal:   '#22c55e',
  monitor:  '#eab308',
  urgent:   '#f97316',
  critical: '#ef4444',
  offline:  '#6b7280',
}
```

Use `L.circleMarker` with radius scaled to `fill_level_pct`. On click → show `BinPopup` with bin detail.

**Step 3 — Vehicle markers.** Read from `useVehicleStore((s) => s.vehicles)`. Use a custom truck SVG icon rotated to `heading_degrees`. Show current cluster / next cluster on hover.

**Step 4 — Route polylines.** When a job is active, draw its waypoints as a dashed polyline. Completed stops = grey, pending stops = blue.

**Step 5 — Sidebar panel.** Clicking a bin opens a slide-in panel (shadcn `Sheet`) showing fill history chart.

---

### Page 3: `/dashboard/bins` — Bin Status Table

**Purpose:** Filterable, sortable table for supervisors to inspect all bins.

**Filters (URL search params):**
- Zone (dropdown populated from zones API)
- Status (normal / monitor / urgent / critical / offline)
- Waste category

**Table columns:**
| Bin ID | Zone | Cluster | Status | Fill % | Urgency Score | Est. Weight | Waste Type | Last Reading |

**Implementation:** Use the `useBins()` hook (from `src/hooks/useBins.ts`) which wraps `useQuery` with `createClientApiClient`. Debounce filter changes. Pagination controls.

**Live updates:** Subscribe to `binStore` with a selector — if a bin in the current page changes status, the row updates without re-fetching.

---

### Page 4: `/dashboard/bins/[id]` — Bin Detail

**Data:** SSR fetch of bin detail + history. Client hydration from store.

**Layout:**
```
Header: Bin ID | Zone | Cluster | Status Badge | Last Reading timestamp

Row 1: Current State Cards
  [Fill Level %]  [Urgency Score]  [Est. Weight kg]  [Battery %]
  [Predicted Full At]  [Fill Rate pct/hr]

Row 2: Fill Level History Chart (line chart, last 24h)
  X-axis: time, Y-axis: fill_level_pct
  Horizontal reference line at 80% (urgent threshold)

Row 3: Recent Collections table
  When | Driver | Job ID | Job Type | Fill at collection | Weight collected
```

---

### Page 5: `/dashboard/jobs` — Collection Jobs

**Purpose:** Full list of all jobs with state filtering.

**Tabs:**
- Active (states: BIN_CONFIRMING through IN_PROGRESS)
- Completed (states: COMPLETED, AUDIT_RECORDED)
- Escalated (state: ESCALATED)
- Cancelled (states: CANCELLED, FAILED)

**Job card fields:**
- Job ID + type badge (ROUTINE / EMERGENCY)
- Zone + creation timestamp
- State badge (color-coded per state group)
- Assigned driver + vehicle
- Bin count + planned weight
- Priority (emergency jobs: 1, routine: varies)

**Supervisor actions:**
- Cancel button on active jobs → `POST /api/v1/collection-jobs/:id/cancel` with body `{ reason: string }`
- Confirm with a dialog before cancelling

**Live:** `job:created` socket event adds card to Active tab. `job:completed` moves it. `alert:escalated` adds to Escalated tab.

---

### Page 6: `/dashboard/jobs/[id]` — Job Detail

**Layout:**

```
Header: Job ID | Type | Zone | Priority | Created at

Section 1: State Machine Stepper
  Horizontal stepper showing all states, highlighting current position
  Emergency jobs: CREATED → BIN_CONFIRMING → BIN_CONFIRMED → CLUSTER_ASSEMBLING
                  → CLUSTER_ASSEMBLED → DISPATCHING → DISPATCHED → DRIVER_NOTIFIED
                  → IN_PROGRESS → COMPLETING → COLLECTION_DONE → COMPLETED
  Completed steps: green | Current: blue | Future: gray
  Failed/Escalated: red

Section 2: Two columns
  Left:  Assignment details (driver, vehicle, planned weight)
  Right: Route map (mini Leaflet map showing waypoints)

Section 3: Bin Collection Progress Table
  Columns: Sequence | Cluster | Bin ID | Waste Type | Est. Weight | Status | Collected At
  Status: pending / collected (green check) / skipped (orange X)
  Updates live from job:progress socket events

Section 4: State History Timeline
  List of state transitions with timestamps and who/what triggered each
```

---

### Page 7: `/dashboard/fleet` — Fleet & Drivers

**Purpose:** Fleet operator's view of all active vehicles.

**Vehicle cards:**
- Vehicle ID + type
- Driver name + status
- Current job ID + zone
- Cargo bar: `cargo_weight_kg / cargo_limit_kg` as a progress bar
  - Green < 70%, Yellow 70-90%, Red > 90%
- Bins collected / total

**Driver availability panel:**
- Count of available, on-job, off-duty drivers
- Table: Driver name | Vehicle | Zone | Status | Shift hours

**Deviation alerts panel:**
- Live feed of `alert:deviation` events
- "LORRY-03 is 650m off planned route" format

---

### Page 8: `/dashboard/analytics` — Trends & ML

**Charts to build:**

1. **Zone Fill Level Over Time** (line chart, Recharts)
   - Data: ML trends API `GET /api/v1/ml/trends/waste-generation`
   - One line per zone, last 7 days

2. **Waste Category Breakdown** (stacked bar chart)
   - Data: zone snapshots from `zone:stats` events
   - X-axis: zones, Y-axis: kg collected, stacked by waste category
   - Use `waste_category_colour` values for bar colors

3. **Bins Predicted to Hit Urgent** (table)
   - Data: ML fill time prediction API
   - Columns: Bin ID | Zone | Current Fill% | Predicted Full At | Hours Remaining
   - Sort by hours remaining ASC

4. **Collection Efficiency** (bar chart)
   - Completed jobs: planned bins vs actual collected vs skipped
   - Group by week

---

## 12. Component Library

### `StatCard`

```tsx
interface StatCardProps {
  label:    string
  value:    string | number
  sublabel?: string
  trend?:  'up' | 'down' | 'neutral'
  urgent?: boolean  // red highlight if true
}
```

### `BinStatusBadge`

```tsx
const STATUS_STYLES = {
  normal:   'bg-green-100 text-green-800',
  monitor:  'bg-yellow-100 text-yellow-800',
  urgent:   'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  offline:  'bg-gray-100 text-gray-800',
}
```

### `JobStateStepper`

Horizontal stepper. States grouped into phases:

```
Phase 1 (grey → green): CREATED, BIN_CONFIRMING, BIN_CONFIRMED
Phase 2 (grey → blue):  CLUSTER_ASSEMBLING, CLUSTER_ASSEMBLED
Phase 3 (grey → blue):  DISPATCHING, DISPATCHED, DRIVER_NOTIFIED
Phase 4 (grey → blue):  IN_PROGRESS, COMPLETING, COLLECTION_DONE
Phase 5 (grey → green): RECORDING_AUDIT, AUDIT_RECORDED, COMPLETED

Terminal failure states → red: FAILED, ESCALATED, CANCELLED, AUDIT_FAILED
SPLIT_JOB → blue terminal: parent job was split into child jobs — watch for new job:created events
```

### `CargoBar`

```tsx
function CargoBar({ used, limit }: { used: number; limit: number }) {
  const pct = (used / limit) * 100
  const color = pct < 70 ? 'bg-green-500' : pct < 90 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}
```

### `AlertFeed`

Reads from `useAlertStore`. Each alert shows:
- Icon: red bell for urgent, orange warning for escalated
- Message text
- `distance_from_now` using `date-fns` formatDistanceToNow
- Dismiss button

---

## 13. Type Definitions

### `src/types/bin.ts`

```typescript
export type BinStatus = 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline'
export type WasteCategory = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste'

// Shape returned by REST GET /api/v1/bins and GET /api/v1/bins/:bin_id
export interface Bin {
  bin_id:                 string
  cluster_id:             string
  cluster_name:           string
  zone_id:                number
  zone_name:              string
  lat:                    number
  lng:                    number
  address:                string
  fill_level_pct:         number
  status:                 BinStatus
  urgency_score:          number
  estimated_weight_kg:    number
  waste_category:         WasteCategory
  waste_category_colour:  string
  predicted_full_at:      string | null
  battery_level_pct:      number
  last_reading_at:        string
  last_collected_at:      string | null
  has_active_job:         boolean
  // Only present on GET /api/v1/bins/:bin_id (single bin detail, not list)
  recent_collections?: Array<{
    job_id:                     string
    collected_at:               string
    driver_id:                  string
    fill_level_at_collection:   number
    actual_weight_kg:           number | null
    job_type:                   'routine' | 'emergency'
  }>
}

// Shape of the bin:update Socket.IO event payload (different from REST Bin)
export interface BinUpdatePayload {
  bin_id:                 string
  cluster_id:             string
  cluster_name:           string
  zone_id:                number
  fill_level_pct:         number
  status:                 BinStatus
  urgency_score:          number
  estimated_weight_kg:    number
  waste_category:         WasteCategory
  waste_category_colour:  string
  fill_rate_pct_per_hour: number
  predicted_full_at:      string | null
  battery_level_pct:      number
  has_active_job:         boolean
  collection_triggered:   boolean
  last_collected_at:      string | null
}

// Shape returned by REST GET /api/v1/bins/:bin_id/history
export interface BinHistory {
  bin_id:    string
  from:      string
  to:        string
  interval:  string
  series: Array<{
    timestamp:            string
    fill_level_pct:       number
    urgency_score:        number
    estimated_weight_kg:  number
  }>
  collection_events: Array<{
    collected_at:               string
    fill_level_at_collection:   number
  }>
}

// Shape returned by REST GET /api/v1/zones/:zone_id/summary
export interface ZoneSummary {
  zone_id:                   number
  zone_name:                 string
  total_bins:                number
  total_clusters:            number
  status_breakdown: {
    normal:   number
    monitor:  number
    urgent:   number
    critical: number
    offline:  number
  }
  category_breakdown: Record<string, {
    total_bins:       number
    avg_fill_pct:     number
    total_weight_kg:  number
    urgent_count:     number
  }>
  total_estimated_weight_kg: number
  active_jobs_count:         number
  last_updated:              string
}

// Shape of the zone:stats Socket.IO event payload (different from REST ZoneSummary)
export interface ZoneStatsPayload {
  zone_id:                   number
  zone_name:                 string
  avg_fill_level_pct:        number
  urgent_bin_count:          number
  critical_bin_count:        number
  total_bins:                number
  total_estimated_weight_kg: number
  dominant_waste_category:   string
  category_breakdown:        Record<string, { count: number; avg_fill: number; total_kg: number }>
  active_jobs_count:         number
  unassigned_urgent_bins:    number
}
```

### `src/types/job.ts`

```typescript
export type JobState =
  | 'CREATED' | 'BIN_CONFIRMING' | 'BIN_CONFIRMED'
  | 'CLUSTER_ASSEMBLING' | 'CLUSTER_ASSEMBLED'
  | 'DISPATCHING' | 'DISPATCHED' | 'DRIVER_NOTIFIED'
  | 'IN_PROGRESS' | 'SPLIT_JOB' | 'COMPLETING' | 'COLLECTION_DONE'
  | 'RECORDING_AUDIT' | 'AUDIT_RECORDED'
  | 'COMPLETED' | 'FAILED' | 'ESCALATED' | 'CANCELLED' | 'AUDIT_FAILED'

export type JobType = 'routine' | 'emergency'

// Shape returned by REST GET /api/v1/collection-jobs (list)
export interface CollectionJobListItem {
  id:                   string
  job_type:             JobType
  zone_id:              number
  zone_name:            string
  state:                JobState
  priority:             number
  assigned_vehicle_id:  string | null
  assigned_driver_id:   string | null
  clusters:             string[]
  planned_weight_kg:    number | null
  actual_weight_kg:     number | null
  bins_total:           number
  bins_collected:       number
  bins_skipped:         number
  created_at:           string
  completed_at:         string | null
  duration_minutes:     number | null
}

// Shape returned by REST GET /api/v1/collection-jobs/:id (job detail — extends list item)
export interface CollectionJobDetail extends CollectionJobListItem {
  trigger_bin_id:         string | null
  trigger_urgency_score:  number | null
  route_plan_id:          string | null
  planned_distance_km:    number | null
  actual_distance_km:     number | null
  planned_duration_min:   number | null
  hyperledger_tx_id:      string | null
  failure_reason:         string | null
  escalated_at:           string | null
  bin_collections: Array<{
    bin_id:                      string
    cluster_id:                  string
    sequence_number:             number
    status:                      'collected' | 'skipped' | 'pending'
    collected_at:                string | null
    fill_level_at_collection:    number | null
    estimated_weight_kg:         number
    actual_weight_kg:            number | null
    skip_reason:                 string | null
  }>
  state_history: Array<{
    from_state:      string | null
    to_state:        string
    reason:          string | null
    actor:           string
    transitioned_at: string
  }>
  step_log: Array<{
    step_name:      string
    attempt_number: number
    success:        boolean
    duration_ms:    number
    executed_at:    string
  }>
}

// Shape of job events received via Socket.IO (job:created, job:completed, job:cancelled)
export interface CollectionJob {
  job_id:               string
  job_type:             JobType
  zone_id:              number
  zone_name:            string
  clusters:             string[]
  vehicle_id:           string
  driver_id:            string | null    // nullable — null when job cancelled before driver assignment
  total_bins:           number
  planned_weight_kg:    number
  priority:             number
  route:                Array<{
    sequence:           number
    cluster_id:         string
    cluster_name:       string
    lat:                number
    lng:                number
    bins:               string[]
    estimated_arrival:  string
  }>
  state?:               JobState
  bins_collected?:      number
  bins_skipped?:        number
  actual_weight_kg?:    number
  duration_minutes?:    number
}

export interface JobProgress {
  job_id:               string
  state:                JobState
  vehicle_id:           string
  driver_id:            string
  driver_name:          string
  total_bins:           number
  bins_collected:       number
  bins_skipped:         number
  bins_pending:         number
  cargo_weight_kg:      number
  cargo_limit_kg:       number
  cargo_utilisation_pct: number
  estimated_completion_at: string | null
  current_stop: {
    cluster_id:              string
    cluster_name:            string
    bins_at_stop:            number
    bins_collected_at_stop:  number
  } | null
  waypoints: Array<{
    sequence:            number
    cluster_id:          string
    cluster_name:        string
    bins:                string[]
    status:              'completed' | 'current' | 'pending'
    arrived_at:          string | null
    completed_at:        string | null
  }>
}
```

### `src/types/vehicle.ts`

```typescript
export interface VehiclePositionPayload {
  vehicle_id:            string
  driver_id:             string
  lat:                   number
  lng:                   number
  speed_kmh:             number
  heading_degrees?:      number    // optional — not always present
  job_id:                string
  zone_id:               number
  current_cluster?:      string    // cluster vehicle is currently servicing
  next_cluster?:         string    // next cluster on route
  bins_collected:        number
  bins_total:            number
  cargo_weight_kg:       number
  cargo_limit_kg:        number
  cargo_utilisation_pct: number
  arrived_at_cluster?:   string   // cluster_id if vehicle just arrived at a stop
  weight_limit_warning?: boolean  // true when cargo > 90% capacity
}

export interface ActiveVehicle {
  vehicle_id:           string
  vehicle_type:         string
  driver_id:            string
  driver_name:          string
  job_id:               string
  job_type:             string
  zone_id:              number
  state:                string
  current_lat:          number | null
  current_lng:          number | null
  last_seen_at:         string | null
  cargo_weight_kg:      number
  cargo_limit_kg:       number
  cargo_utilisation_pct: number
  bins_collected:       number
  bins_total:           number
}

export interface Driver {
  driver_id:    string
  driver_name:  string
  vehicle_id:   string
  vehicle_type: string
  zone_id:      number
  status:       'available' | 'on_job' | 'off_duty'
}
```

---

## 14. Running Locally

### Prerequisites

- Node.js 20+
- Docker Desktop (for the platform services)
- Access to the group's Kubernetes cluster OR the local docker-compose setup

### Step 1 — Start the platform services locally

The Platform repo (`Smart-Waste-Management-System-Platform`) contains a one-command setup script managed by F4:

```bash
cd Smart-Waste-Management-System-Platform
chmod +x scripts/setup-local.sh && ./scripts/setup-local.sh
```

This starts: Keycloak, Kong, Kafka, EMQX, and all supporting services in Minikube.

### Step 2 — Start the backend services

Each F3 service runs independently. In separate terminals:

```bash
# Bin Status Service (ask F3 teammate for repo)
cd bin-status-service && npm run dev

# Notification Service (Socket.IO — most important for dashboard)
cd notification-service && npm run dev

# Workflow Orchestrator
cd workflow-orchestrator && npm run dev

# Scheduler Service
cd scheduler-service && npm run dev
```

**If backend services aren't ready yet:** You can mock the Socket.IO connection and REST APIs using MSW (Mock Service Worker). See the Testing section.

### Step 3 — Configure Kong routes

Kong needs routes pointing to each service. F4 handles this in production via `kong-config.yaml`. For local dev, you can use Kong's Admin API directly:

```bash
# Register Bin Status Service route in Kong
curl -X POST http://localhost:8001/services \
  -d name=bin-status \
  -d url=http://host.docker.internal:3001

curl -X POST http://localhost:8001/services/bin-status/routes \
  -d paths[]=/api/v1/bins \
  -d paths[]=/api/v1/zones
```

Ask F4 for the full Kong route setup script.

### Step 4 — Run the dashboard

```bash
cd dashboard
cp .env.example .env.local
# Fill in the values (get Keycloak client secret from F4)
npm run dev
```

Dashboard runs at `http://localhost:3000`.

### Step 5 — Test users (already pre-created — no manual setup needed)

The `realm-export.json` in the Platform repo pre-creates these users automatically on Keycloak startup:

| Email | Password | Role |
|---|---|---|
| `supervisor@swms-dev.local` | `swms-supervisor-dev` | supervisor |
| `driver@swms-dev.local` | `swms-driver-dev` | driver |

To log into Keycloak admin if you need to inspect or add users:
```
URL:  http://localhost:30180/admin
User: admin
Pass: swms-admin-dev-2026
Realm: waste-management
```

Note: `zone_id` is only set on the driver user. The supervisor user has no `zone_id` attribute — supervisors see all zones by design.

---

## 15. Testing

### 15.1 Unit tests — Zustand stores

```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

```typescript
// src/store/__tests__/binStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useBinStore } from '../binStore'

describe('binStore', () => {
  beforeEach(() => useBinStore.setState({ bins: new Map(), zones: new Map() }))

  it('adds a bin on updateBin', () => {
    const payload = { bin_id: 'BIN-001', status: 'urgent', urgency_score: 85 } as any
    useBinStore.getState().updateBin(payload)
    expect(useBinStore.getState().bins.get('BIN-001')?.urgency_score).toBe(85)
  })

  it('overwrites existing bin on updateBin', () => {
    const p1 = { bin_id: 'BIN-001', status: 'monitor', urgency_score: 55 } as any
    const p2 = { bin_id: 'BIN-001', status: 'urgent',  urgency_score: 85 } as any
    useBinStore.getState().updateBin(p1)
    useBinStore.getState().updateBin(p2)
    expect(useBinStore.getState().bins.get('BIN-001')?.status).toBe('urgent')
  })
})
```

### 15.2 Component tests — BinStatusBadge

```typescript
// src/components/bins/__tests__/BinStatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { BinStatusBadge } from '../BinStatusBadge'

it.each(['normal', 'monitor', 'urgent', 'critical', 'offline'])(
  'renders %s status with correct text',
  (status) => {
    render(<BinStatusBadge status={status as any} />)
    expect(screen.getByText(status)).toBeInTheDocument()
  }
)
```

### 15.3 Mocking the Socket.IO connection with MSW

Install MSW for mocking REST APIs during development without backend:

```bash
npm install -D msw
npx msw init public/
```

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('http://localhost:30080/api/v1/bins', () => {
    return HttpResponse.json({
      data: [
        { bin_id: 'BIN-001', zone_id: 1, status: 'urgent', fill_level_pct: 85,
          urgency_score: 88, estimated_weight_kg: 18.4, waste_category: 'food_waste',
          lat: 3.1390, lng: 101.6869, ... }
      ],
      total: 1, page: 1, limit: 50
    })
  }),

  http.get('http://localhost:30080/api/v1/collection-jobs', () => {
    return HttpResponse.json({ data: [], total: 0, page: 1 })
  }),
]
```

For Socket.IO mocking during manual testing, you can emit fake events from the browser console:

```javascript
// Paste in browser console (requires socket ref to be accessible)
window.__socket.emit('bin:update', {
  bin_id: 'BIN-001', status: 'critical', urgency_score: 95,
  fill_level_pct: 97, zone_id: 1, ...
})
```

To make this work, expose the socket in dev mode:

```typescript
// src/lib/socket.ts — add at bottom (dev only)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).__socket = socket
}
```

### 15.4 E2E tests with Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test('redirects to login when not authenticated', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard')
  await expect(page).toHaveURL(/login/)
})

test('shows zone cards on overview page', async ({ page }) => {
  // Login first via Keycloak
  await page.goto('http://localhost:3000/login')
  await page.click('button[type="submit"]')
  // ... Keycloak login flow
  await expect(page.locator('[data-testid="zone-card"]').first()).toBeVisible()
})
```

### 15.5 Running tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test -- --coverage

# E2E tests
npx playwright test
npx playwright test --ui   # visual mode
```

---

## 16. Docker & Deployment

### 16.1 `Dockerfile` for the dashboard

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args become env vars at build time (public vars only)
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.ts`:

```typescript
const nextConfig = {
  output: 'standalone',
}
export default nextConfig
```

### 16.2 Build and run with Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://kong.gateway.svc.cluster.local:8000 \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://kong.gateway.svc.cluster.local:8000 \
  -t swms-dashboard:latest .

docker run -p 3000:3000 \
  -e AUTH_SECRET=<secret> \
  -e AUTH_KEYCLOAK_ID=swms-dashboard \
  -e AUTH_KEYCLOAK_SECRET=dashboard-client-secret-dev \
  -e AUTH_KEYCLOAK_ISSUER=http://keycloak.auth.svc.cluster.local/realms/waste-management \
  swms-dashboard:latest
```

### 16.3 Kubernetes deployment (F4 handles this)

Provide F4 with:
- The Docker image name: `swms-dashboard:latest`
- Port: 3000
- Environment variables list (from Section 5)
- Kong route to register: `/dashboard → swms-dashboard:3000`

---

## 17. End-to-End Integration Checklist

Work through this list systematically. Each item confirms a specific integration point works.

### Authentication
- [ ] Visiting `/dashboard` without login redirects to `/login`
- [ ] Keycloak login completes and redirects back to `/dashboard`
- [ ] Session contains `accessToken` with correct role and zone_id
- [ ] Calling a Kong API route with the token returns 200, not 401

### REST API — Bin Status Service
- [ ] `GET /api/v1/bins` returns paginated bin list
- [ ] `GET /api/v1/bins/BIN-001` returns single bin with all fields
- [ ] `GET /api/v1/bins/BIN-001/history` returns fill level time series
- [ ] `GET /api/v1/zones/1/summary` returns zone stats
- [ ] Bins table page renders with data

### REST API — Orchestrator
- [ ] `GET /api/v1/collection-jobs` returns job list
- [ ] `GET /api/v1/collection-jobs/:id` returns job detail with state history
- [ ] `POST /api/v1/collection-jobs/:id/cancel` returns success and updates job state

### REST API — Scheduler
- [ ] `GET /api/v1/vehicles/active` returns active vehicle list

> **Note:** `GET /api/v1/jobs/:id/progress` and `GET /api/v1/drivers/available` are internal scheduler endpoints not routed through Kong. Job progress is delivered via the `job:progress` Socket.IO event.

### Socket.IO Connection
- [ ] `getSocket(token)` connects successfully to Notification Service
- [ ] Connection authenticated — check Notification Service logs show correct role
- [ ] Subscribed to correct rooms (`dashboard-all`, `alerts-all`)

### Socket.IO — Bin events
- [ ] `bin:update` event → `useBinStore` updates the bin
- [ ] Updated bin reflects immediately on map page (marker color changes)
- [ ] Updated bin reflects immediately in bins table (status cell updates)
- [ ] `zone:stats` event → `useBinStore` updates the zone
- [ ] Zone card on overview page updates fill level bar
- [ ] `alert:urgent` event → `useAlertStore` adds an alert
- [ ] Alert appears in the alert feed

### Socket.IO — Vehicle events
- [ ] `vehicle:position` event → `useVehicleStore` updates vehicle
- [ ] Vehicle marker on map moves to new coordinates
- [ ] Cargo bar on fleet page updates
- [ ] `job:progress` event → `useJobStore` updates job
- [ ] Job detail page bin table row status updates

### Socket.IO — Job lifecycle events
- [ ] `job:created` event → new job card appears in Active Jobs tab
- [ ] `job:completed` event → job moves to Completed tab
- [ ] `job:cancelled` event → job moves to Cancelled tab
- [ ] `alert:escalated` event → job appears in Escalated tab + alert in feed

### Map page
- [ ] All bins render as circle markers at correct coordinates
- [ ] Bin markers are colored by status
- [ ] Clicking a bin opens popup with bin detail
- [ ] Active vehicles show as truck icons
- [ ] Route polyline renders for active jobs

### Error handling
- [ ] API 401 → sign out and redirect to login
- [ ] API 500 → toast error message, do not crash
- [ ] Socket.IO disconnect → show "Reconnecting..." indicator in topbar
- [ ] Socket.IO reconnect → no duplicate event handlers registered

---

## 18. Common Pitfalls

### Leaflet SSR error
**Problem:** `window is not defined` when importing Leaflet.
**Fix:** Always wrap Leaflet components in `dynamic(..., { ssr: false })`. Never import Leaflet at the top level of a Server Component or a file that gets imported on the server.

### Socket.IO duplicate event handlers
**Problem:** Each re-render re-registers event handlers, causing events to fire N times.
**Fix:** Always return a cleanup function from `useEffect` that calls `sock.off('event-name')`. The `SocketProvider` pattern in Section 8.2 handles this correctly — do not register socket listeners inside individual components.

### Map icon broken in Next.js (Leaflet default icons)
**Problem:** Default Leaflet marker icons 404 due to webpack asset handling.
**Fix:** In your map file, add:

```typescript
import L from 'leaflet'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})
```

Copy the leaflet marker images into `public/leaflet/`.

### Calling API functions from Client Components (server-only crash)
**Problem:** Calling `getBins()` (or any api/ function) directly inside `useQuery` in a Client Component will crash with a build error like `"This module cannot be imported from a Client Component"`. This happens when the function internally imports `auth` from NextAuth, which is server-only.
**Fix:** All `src/lib/api/` functions take a `KyInstance` as their first argument — they have no server-only imports. Always pass `createClientApiClient(session.accessToken)` from the Client Component, or use the pre-built hooks in `src/hooks/`. Never import `createApiClient` (server) inside a Client Component.

### TanStack Query + Server Components
**Problem:** `useQuery` cannot run in Server Components.
**Fix:** Use Server Components only for the initial SSR data fetch. Pass `createApiClient()` (server) into the api/ functions there. Use `useQuery` only inside `'use client'` components, passing `createClientApiClient(token)` (client). The pattern is: Server Component fetches + passes as `initialData` prop → Client Component uses `initialData` in `useQuery`.

### NextAuth session missing accessToken in Client Components
**Problem:** `useSession()` returns session but `accessToken` is undefined.
**Fix:** Make sure the `jwt` callback in `src/auth.ts` saves `account.access_token` to `token.accessToken`, AND the `session` callback copies `token.accessToken` to `session.accessToken`. Both callbacks are required.

### Kong CORS
**Problem:** Browser blocks API calls to Kong due to CORS policy.
**Fix:** Tell F4 to enable the CORS plugin on Kong for `http://localhost:3000`. Or proxy API calls through Next.js API routes to avoid CORS entirely — create `src/app/api/proxy/[...path]/route.ts` that adds the auth header and forwards to Kong.

### Zustand state with Map objects and React re-renders
**Problem:** `useBinStore((s) => s.bins)` does not trigger re-render when a bin is updated because the Map reference changes but React doesn't know.
**Fix:** Always create a `new Map(...)` in the store setter (as shown in Section 9.1). This ensures the reference changes and React triggers a re-render. Never mutate an existing Map in-place.
