import type { KyInstance } from 'ky'

export type Row = Record<string, unknown>

export interface ListResult {
  data: Row[]
  total: number
  page: number
  pages: number
}

function normaliseList(raw: unknown): ListResult {
  const r = raw as Record<string, unknown>
  const data = (r.data ?? r.items ?? (Array.isArray(r) ? r : [])) as Row[]
  const pagination = r.pagination as Record<string, number> | undefined
  const total = Number(pagination?.total ?? r.total ?? data.length)
  const page  = Number(pagination?.page  ?? r.page  ?? 1)
  const pages = Number(pagination?.pages ?? r.pages ?? 1)
  return { data, total, page, pages }
}

function clean(params?: Record<string, string | number>): Record<string, string | number> {
  if (!params) return {}
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  ) as Record<string, string | number>
}

// ── F2 Tables (via /api/metadata/[...path] proxy) ────────────────────────────

export async function listWasteCategories(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/waste-categories', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function createWasteCategory(api: KyInstance, payload: Row) {
  return api.post('api/metadata/waste-categories', { json: payload }).json<Row>()
}
export async function updateWasteCategory(api: KyInstance, id: number | string, payload: Row) {
  return api.patch(`api/metadata/waste-categories/${id}`, { json: payload }).json<Row>()
}
export async function deleteWasteCategory(api: KyInstance, id: number | string) {
  return api.delete(`api/metadata/waste-categories/${id}`)
}

export async function listCityZones(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/city-zones', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function createCityZone(api: KyInstance, payload: Row) {
  const res = await api.post('api/metadata/city-zones', { json: payload }).json<{ data?: Row } | Row>()
  return (res as { data?: Row }).data ?? res as Row
}
export async function updateCityZone(api: KyInstance, id: number | string, payload: Row) {
  return api.patch(`api/metadata/city-zones/${id}`, { json: payload }).json<Row>()
}
export async function deleteCityZone(api: KyInstance, id: number | string) {
  return api.delete(`api/metadata/city-zones/${id}`)
}

export async function listVehicles(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/vehicles', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function createVehicle(api: KyInstance, payload: Row) {
  const res = await api.post('api/metadata/vehicles', { json: payload }).json<{ data?: Row } | Row>()
  return (res as { data?: Row }).data ?? res as Row
}
export async function updateVehicle(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/metadata/vehicles/${id}`, { json: payload }).json<Row>()
}
export async function deleteVehicle(api: KyInstance, id: string) {
  return api.delete(`api/metadata/vehicles/${id}`)
}

export async function listClusters(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/clusters', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function createCluster(api: KyInstance, payload: Row) {
  const res = await api.post('api/metadata/clusters', { json: payload }).json<{ data?: Row } | Row>()
  return (res as { data?: Row }).data ?? res as Row
}
export async function updateCluster(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/metadata/clusters/${id}`, { json: payload }).json<Row>()
}
export async function deleteCluster(api: KyInstance, id: string) {
  return api.delete(`api/metadata/clusters/${id}`)
}

export async function listBins(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/bins', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function createBinRecord(api: KyInstance, payload: Row) {
  const res = await api.post('api/metadata/bins', { json: payload }).json<{ data?: Row } | Row>()
  return (res as { data?: Row }).data ?? res as Row
}
export async function updateBinRecord(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/metadata/bins/${id}`, { json: payload }).json<Row>()
}
export async function deleteBinRecord(api: KyInstance, id: string) {
  return api.delete(`api/metadata/bins/${id}`)
}

export async function listDevices(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/devices', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function updateDevice(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/metadata/devices/${id}`, { json: payload }).json<Row>()
}
export async function deleteDevice(api: KyInstance, id: string) {
  return api.delete(`api/metadata/devices/${id}`)
}

export async function listRoutePlans(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/route-plans', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function updateRoutePlan(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/metadata/route-plans/${id}`, { json: payload }).json<Row>()
}

export async function listZoneSnapshots(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/zone-snapshots', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listModelPerformance(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/metadata/model-performance', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function updateModelPerformance(api: KyInstance, id: number | string, payload: Row) {
  return api.patch(`api/metadata/model-performance/${id}`, { json: payload }).json<Row>()
}

// ── F3 Tables (via /api/v1/... gateway) ─────────────────────────────────────

export async function listDrivers(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/drivers', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
export async function updateDriverRecord(api: KyInstance, id: string, payload: Row) {
  return api.patch(`api/v1/drivers/${id}`, { json: payload }).json<Row>()
}

export async function listCollectionJobs(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/collection-jobs', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listBinStates(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/bins', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}
