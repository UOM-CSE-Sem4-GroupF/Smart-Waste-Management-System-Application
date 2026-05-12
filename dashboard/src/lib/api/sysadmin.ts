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

// ── Generic F3 CRUD Helpers ────────────────────────────────────────────────

async function createF3(api: KyInstance, table: string, payload: Row) {
  return api.post(`api/v1/${table}`, { json: payload }).json<Row>()
}
async function updateF3(api: KyInstance, table: string, id: string, payload: Row) {
  return api.patch(`api/v1/${table}/${id}`, { json: payload }).json<Row>()
}
async function deleteF3(api: KyInstance, table: string, id: string) {
  return api.delete(`api/v1/${table}/${id}`).json()
}

// ── Collection Jobs ──
export async function listCollectionJobs(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/collection-jobs', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createCollectionJob = (api: KyInstance, p: Row) => createF3(api, 'collection-jobs', p);
export const updateCollectionJob = (api: KyInstance, id: string, p: Row) => updateF3(api, 'collection-jobs', id, p);
export const deleteCollectionJob = (api: KyInstance, id: string) => deleteF3(api, 'collection-jobs', id);

// ── Routine Schedules ──
export async function listRoutineSchedules(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/routine-schedules', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createRoutineSchedule = (api: KyInstance, p: Row) => createF3(api, 'routine-schedules', p);
export const updateRoutineSchedule = (api: KyInstance, id: string, p: Row) => updateF3(api, 'routine-schedules', id, p);
export const deleteRoutineSchedule = (api: KyInstance, id: string) => deleteF3(api, 'routine-schedules', id);

// ── Emergency Job Details ──
export async function listEmergencyJobDetails(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/emergency-job-details', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createEmergencyJobDetail = (api: KyInstance, p: Row) => createF3(api, 'emergency-job-details', p);
export const updateEmergencyJobDetail = (api: KyInstance, id: string, p: Row) => updateF3(api, 'emergency-job-details', id, p);
export const deleteEmergencyJobDetail = (api: KyInstance, id: string) => deleteF3(api, 'emergency-job-details', id);

// ── Routine Job Details ──
export async function listRoutineJobDetails(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/routine-job-details', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createRoutineJobDetail = (api: KyInstance, p: Row) => createF3(api, 'routine-job-details', p);
export const updateRoutineJobDetail = (api: KyInstance, id: string, p: Row) => updateF3(api, 'routine-job-details', id, p);
export const deleteRoutineJobDetail = (api: KyInstance, id: string) => deleteF3(api, 'routine-job-details', id);

// ── Job Execution Metrics ──
export async function listJobExecutionMetrics(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-execution-metrics', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createJobExecutionMetric = (api: KyInstance, p: Row) => createF3(api, 'job-execution-metrics', p);
export const updateJobExecutionMetric = (api: KyInstance, id: string, p: Row) => updateF3(api, 'job-execution-metrics', id, p);
export const deleteJobExecutionMetric = (api: KyInstance, id: string) => deleteF3(api, 'job-execution-metrics', id);

// ── Bin Collection Records ──
export async function listBinCollectionRecords(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/bin-collection-records', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createBinCollectionRecord = (api: KyInstance, p: Row) => createF3(api, 'bin-collection-records', p);
export const updateBinCollectionRecord = (api: KyInstance, id: string, p: Row) => updateF3(api, 'bin-collection-records', id, p);
export const deleteBinCollectionRecord = (api: KyInstance, id: string) => deleteF3(api, 'bin-collection-records', id);

// ── Job State Transitions ──
export async function listJobStateTransitions(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-state-transitions', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createJobStateTransition = (api: KyInstance, p: Row) => createF3(api, 'job-state-transitions', p);
export const updateJobStateTransition = (api: KyInstance, id: string, p: Row) => updateF3(api, 'job-state-transitions', id, p);
export const deleteJobStateTransition = (api: KyInstance, id: string) => deleteF3(api, 'job-state-transitions', id);

// ── Job Step Results ──
export async function listJobStepResults(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/job-step-results', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createJobStepResult = (api: KyInstance, p: Row) => createF3(api, 'job-step-results', p);
export const updateJobStepResult = (api: KyInstance, id: string, p: Row) => updateF3(api, 'job-step-results', id, p);
export const deleteJobStepResult = (api: KyInstance, id: string) => deleteF3(api, 'job-step-results', id);

// ── Driver Assignment History ──
export async function listDriverAssignmentHistory(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/driver-assignment-history', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createDriverAssignmentHistory = (api: KyInstance, p: Row) => createF3(api, 'driver-assignment-history', p);
export const updateDriverAssignmentHistory = (api: KyInstance, id: string, p: Row) => updateF3(api, 'driver-assignment-history', id, p);
export const deleteDriverAssignmentHistory = (api: KyInstance, id: string) => deleteF3(api, 'driver-assignment-history', id);

// ── Vehicle Weight Logs ──
export async function listVehicleWeightLogs(api: KyInstance, params?: Record<string, string | number>) {
  const raw = await api.get('api/v1/vehicle-weight-logs', { searchParams: clean(params) }).json(); return normaliseList(raw);
}
export const createVehicleWeightLog = (api: KyInstance, p: Row) => createF3(api, 'vehicle-weight-logs', p);
export const updateVehicleWeightLog = (api: KyInstance, id: string, p: Row) => updateF3(api, 'vehicle-weight-logs', id, p);
export const deleteVehicleWeightLog = (api: KyInstance, id: string) => deleteF3(api, 'vehicle-weight-logs', id);


