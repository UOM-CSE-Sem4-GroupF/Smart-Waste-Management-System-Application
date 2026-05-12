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

export async function listRoutineSchedules(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/routine-schedules', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listEmergencyJobDetails(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/emergency-job-details', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listRoutineJobDetails(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/routine-job-details', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listJobExecutionMetrics(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-execution-metrics', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listBinCollectionRecords(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/bin-collection-records', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listJobStateTransitions(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-state-transitions', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listJobStepResults(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-step-results', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listDriverAssignmentHistory(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/driver-assignment-history', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}

export async function listVehicleWeightLogs(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/vehicle-weight-logs', { searchParams: clean(params) }).json()
  return normaliseList(raw)
}


