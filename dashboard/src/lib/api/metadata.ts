import type { KyInstance } from 'ky'

export type ZoneOption = { id: number; name: string; code?: string; active?: boolean }

export type CoreZone = {
  id: number
  name: string
  code?: string
  collection_day?: string
  collection_time?: string
  active?: boolean
  notes?: string | null
}

export type CoreCluster = {
  id: string
  zone_id: number
  name: string
  lat: number | string | null
  lng: number | string | null
  address?: string | null
  cluster_type?: string | null
  active?: boolean
  zone?: { id: number; name: string; code?: string }
  bins?: Array<{ id: string; waste_category_id?: number; volume_litres?: number | string }>
}

export type CoreWasteCategory = {
  id: number
  name: string
  colour_code?: string
  recyclable?: boolean
  special_handling?: boolean
}

export type CoreBin = {
  id: string
  cluster_id: string
  waste_category_id: number
  volume_litres: number | string
  lat: number | string | null
  lng: number | string | null
  address?: string | null
  active?: boolean
  depth_cm?: number | string | null
  notes?: string | null
  cluster?: {
    id: string
    name: string
    zone_id: number
    lat?: number | string | null
    lng?: number | string | null
    zone?: { id: number; name: string; code?: string }
  }
  waste_category?: CoreWasteCategory & { avg_kg_per_litre?: number | string }
  current_state?: {
    fill_level_pct?: number | string
    battery_level_pct?: number | string
    estimated_weight_kg?: number | string
    status?: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline' | string
    urgency_score?: number | string
    predicted_full_at?: string | null
    last_reading_at?: string
    last_collected_at?: string | null
    zone_id?: number | string
  } | null
}

export type CoreListResponse<T> = {
  data: T[]
  pagination?: { page: number; limit: number; total: number; pages: number }
  total?: number
  page?: number
  limit?: number
}

export type HierarchyBin = {
  bin_id: string
  cluster_id: string
  cluster_name: string
  zone_id: number
  zone_name: string
  lat: number
  lng: number
  address: string
  fill_level_pct: number | null
  status: 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline'
  urgency_score: number
  estimated_weight_kg: number | null
  waste_category: string
  waste_category_id: number
  waste_category_colour: string
  predicted_full_at: string | null
  battery_level_pct: number | null
  last_reading_at: string | null
  last_collected_at: string | null
  active: boolean
  volume_litres: number
  depth_cm: number | null
  notes?: string | null
}

export type CreateZonePayload = {
  name: string
  code: string
  collection_day?: string
  collection_time?: string
  notes?: string
}

export type CreateClusterPayload = {
  id: string
  zone_id: number
  name: string
  lat: number
  lng: number
  address?: string
  cluster_type?: string
  notes?: string
}

export type CreateBinPayload = {
  id: string
  cluster_id: string
  waste_category_id: number
  volume_litres: number
  lat?: number
  lng?: number
  address?: string
  depth_cm?: number
  notes?: string
}

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normaliseZone(zone: CoreZone): ZoneOption {
  return {
    id: Number(zone.id),
    name: zone.name,
    code: zone.code,
    active: zone.active ?? true,
  }
}

export function normaliseBin(bin: CoreBin): HierarchyBin {
  const status = bin.current_state?.status
  const safeStatus = ['normal', 'monitor', 'urgent', 'critical', 'offline'].includes(String(status))
    ? status as HierarchyBin['status']
    : 'normal'

  return {
    bin_id: bin.id,
    cluster_id: bin.cluster_id,
    cluster_name: bin.cluster?.name ?? bin.cluster_id,
    zone_id: Number(bin.cluster?.zone_id ?? bin.current_state?.zone_id ?? 0),
    zone_name: bin.cluster?.zone?.name ?? `Zone ${bin.cluster?.zone_id ?? ''}`.trim(),
    lat: numberOrZero(bin.lat ?? bin.cluster?.lat),
    lng: numberOrZero(bin.lng ?? bin.cluster?.lng),
    address: bin.address ?? '',
    fill_level_pct: numberOrNull(bin.current_state?.fill_level_pct),
    status: safeStatus,
    urgency_score: numberOrZero(bin.current_state?.urgency_score),
    estimated_weight_kg: numberOrNull(bin.current_state?.estimated_weight_kg),
    waste_category: bin.waste_category?.name ?? String(bin.waste_category_id),
    waste_category_id: Number(bin.waste_category_id),
    waste_category_colour: bin.waste_category?.colour_code ?? '#808080',
    predicted_full_at: bin.current_state?.predicted_full_at ?? null,
    battery_level_pct: numberOrNull(bin.current_state?.battery_level_pct),
    last_reading_at: bin.current_state?.last_reading_at ?? null,
    last_collected_at: bin.current_state?.last_collected_at ?? null,
    active: bin.active ?? true,
    volume_litres: numberOrZero(bin.volume_litres),
    depth_cm: numberOrNull(bin.depth_cm),
    notes: bin.notes,
  }
}

export async function listZones(api: KyInstance): Promise<ZoneOption[]> {
  const res = await api.get('data-analysis/api/v1/city-zones').json<CoreListResponse<CoreZone>>()
  return res.data.map(normaliseZone).filter((z) => Number.isFinite(z.id))
}

export async function createZone(api: KyInstance, payload: CreateZonePayload): Promise<ZoneOption> {
  const res = await api.post('data-analysis/api/v1/city-zones', { json: payload }).json<{ data: CoreZone }>()
  return normaliseZone(res.data)
}

export async function updateZone(api: KyInstance, id: number, payload: Partial<CreateZonePayload> & { active?: boolean }) {
  return api.patch(`data-analysis/api/v1/city-zones/${id}`, { json: payload }).json()
}

export async function deleteZone(api: KyInstance, id: number) {
  return api.delete(`data-analysis/api/v1/city-zones/${id}`)
}

export async function listClusters(api: KyInstance, zoneId?: number): Promise<CoreCluster[]> {
  const res = await api.get('data-analysis/api/v1/clusters', {
    searchParams: zoneId ? { zone_id: zoneId } : undefined,
  }).json<CoreListResponse<CoreCluster>>()
  return res.data
}

export async function createCluster(api: KyInstance, payload: CreateClusterPayload): Promise<CoreCluster> {
  const res = await api.post('data-analysis/api/v1/clusters', { json: payload }).json<{ data: CoreCluster }>()
  return res.data
}

export async function updateCluster(api: KyInstance, id: string, payload: Partial<CreateClusterPayload> & { active?: boolean }) {
  return api.patch(`data-analysis/api/v1/clusters/${id}`, { json: payload }).json()
}

export async function deleteCluster(api: KyInstance, id: string) {
  return api.delete(`data-analysis/api/v1/clusters/${id}`)
}

export async function listWasteCategories(api: KyInstance): Promise<CoreWasteCategory[]> {
  const res = await api.get('data-analysis/api/v1/waste-categories').json<CoreListResponse<CoreWasteCategory>>()
  return res.data
}

export async function listBins(api: KyInstance, params: { zoneId?: number; clusterId?: string; page?: number; limit?: number }) {
  const searchParams: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  }
  if (params.zoneId) searchParams.zone_id = params.zoneId
  if (params.clusterId) searchParams.cluster_id = params.clusterId

  const res = await api.get('data-analysis/api/v1/bins', { searchParams }).json<CoreListResponse<CoreBin>>()
  return {
    data: res.data.map(normaliseBin),
    total: res.pagination?.total ?? res.total ?? res.data.length,
    page: res.pagination?.page ?? res.page ?? params.page ?? 1,
    pages: res.pagination?.pages ?? 1,
  }
}

export async function createBin(api: KyInstance, payload: CreateBinPayload): Promise<HierarchyBin> {
  const res = await api.post('data-analysis/api/v1/bins', { json: payload }).json<{ data: CoreBin }>()
  return normaliseBin(res.data)
}

export async function updateBin(api: KyInstance, id: string, payload: Partial<CreateBinPayload> & { active?: boolean }) {
  return api.patch(`data-analysis/api/v1/bins/${id}`, { json: payload }).json()
}

export async function deleteBin(api: KyInstance, id: string) {
  return api.delete(`data-analysis/api/v1/bins/${id}`)
}
