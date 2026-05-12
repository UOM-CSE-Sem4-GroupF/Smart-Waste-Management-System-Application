// All fetch calls go through the /api/metadata/[...path] proxy which forwards
// to CORE_API_BASE_URL (f2) or directly to the gateway (f3).
// Paths prefixed with "metadata:" use the Next.js proxy; "direct:" use the gateway.

export type Row = Record<string, unknown>

export interface ListResult {
  data: Row[]
  total: number
  page: number
  pages: number
}

async function metadataFetch<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  searchParams?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`/api/metadata/${path}`, window.location.origin)
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`)
  }
  return res.json() as T
}

async function gatewayFetch<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  searchParams?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`/${path}`, window.location.origin)
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`)
  }
  return res.json() as T
}

function normaliseList(raw: unknown): ListResult {
  const r = raw as Record<string, unknown>
  const data = (r.data ?? r.items ?? (Array.isArray(r) ? r : [])) as Row[]
  const pagination = r.pagination as Record<string, number> | undefined
  const total = Number(pagination?.total ?? r.total ?? data.length)
  const page = Number(pagination?.page ?? r.page ?? 1)
  const pages = Number(pagination?.pages ?? r.pages ?? 1)
  return { data, total, page, pages }
}

// ── F2 Tables ────────────────────────────────────────────────────────────────

export async function listWasteCategories(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('waste-categories', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function createWasteCategory(payload: Row) {
  return metadataFetch<Row>('waste-categories', 'POST', payload)
}
export async function updateWasteCategory(id: number | string, payload: Row) {
  return metadataFetch<Row>(`waste-categories/${id}`, 'PATCH', payload)
}
export async function deleteWasteCategory(id: number | string) {
  return metadataFetch<void>(`waste-categories/${id}`, 'DELETE')
}

export async function listCityZones(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('city-zones', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function createCityZone(payload: Row) {
  return metadataFetch<{ data: Row }>('city-zones', 'POST', payload).then((r) => r.data)
}
export async function updateCityZone(id: number | string, payload: Row) {
  return metadataFetch<Row>(`city-zones/${id}`, 'PATCH', payload)
}
export async function deleteCityZone(id: number | string) {
  return metadataFetch<void>(`city-zones/${id}`, 'DELETE')
}

export async function listVehicles(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('vehicles', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function createVehicle(payload: Row) {
  return metadataFetch<{ data: Row }>('vehicles', 'POST', payload).then((r) => r.data ?? r)
}
export async function updateVehicle(id: string, payload: Row) {
  return metadataFetch<Row>(`vehicles/${id}`, 'PATCH', payload)
}
export async function deleteVehicle(id: string) {
  return metadataFetch<void>(`vehicles/${id}`, 'DELETE')
}

export async function listClusters(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('clusters', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function createCluster(payload: Row) {
  return metadataFetch<{ data: Row }>('clusters', 'POST', payload).then((r) => r.data ?? r)
}
export async function updateCluster(id: string, payload: Row) {
  return metadataFetch<Row>(`clusters/${id}`, 'PATCH', payload)
}
export async function deleteCluster(id: string) {
  return metadataFetch<void>(`clusters/${id}`, 'DELETE')
}

export async function listBins(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('bins', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function createBinRecord(payload: Row) {
  return metadataFetch<{ data: Row }>('bins', 'POST', payload).then((r) => r.data ?? r)
}
export async function updateBinRecord(id: string, payload: Row) {
  return metadataFetch<Row>(`bins/${id}`, 'PATCH', payload)
}
export async function deleteBinRecord(id: string) {
  return metadataFetch<void>(`bins/${id}`, 'DELETE')
}

export async function listDevices(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('devices', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function updateDevice(id: string, payload: Row) {
  return metadataFetch<Row>(`devices/${id}`, 'PATCH', payload)
}
export async function deleteDevice(id: string) {
  return metadataFetch<void>(`devices/${id}`, 'DELETE')
}

export async function listRoutePlans(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('route-plans', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function updateRoutePlan(id: string, payload: Row) {
  return metadataFetch<Row>(`route-plans/${id}`, 'PATCH', payload)
}

export async function listZoneSnapshots(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('zone-snapshots', 'GET', undefined, params)
  return normaliseList(raw)
}

export async function listModelPerformance(params?: Record<string, string | number>) {
  const raw = await metadataFetch<unknown>('model-performance', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function updateModelPerformance(id: number | string, payload: Row) {
  return metadataFetch<Row>(`model-performance/${id}`, 'PATCH', payload)
}

// ── F3 Tables ────────────────────────────────────────────────────────────────

export async function listDrivers(params?: Record<string, string | number>) {
  const raw = await gatewayFetch<unknown>('api/v1/drivers', 'GET', undefined, params)
  return normaliseList(raw)
}
export async function updateDriverRecord(id: string, payload: Row) {
  return gatewayFetch<Row>(`api/v1/drivers/${id}`, 'PATCH', payload)
}

export async function listCollectionJobs(params?: Record<string, string | number>) {
  const raw = await gatewayFetch<unknown>('api/v1/collection-jobs', 'GET', undefined, params)
  return normaliseList(raw)
}

export async function listBinStates(params?: Record<string, string | number>) {
  const raw = await gatewayFetch<unknown>('api/v1/bins', 'GET', undefined, params)
  return normaliseList(raw)
}
