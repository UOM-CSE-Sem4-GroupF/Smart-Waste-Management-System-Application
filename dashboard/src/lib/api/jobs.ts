import type { KyInstance } from 'ky'
import type { CollectionJobListItem, CollectionJobDetail, JobProgress, JobState, JobType } from '@/types'

// Maps the real backend shape (job_id, string zone_id, missing fields) to CollectionJobListItem
function normalizeJob(raw: Record<string, unknown>): CollectionJobListItem {
  const binsToCollect = (raw.bins_to_collect as string[] | undefined) ?? []
  return {
    id:                  ((raw.id ?? raw.job_id) as string),
    job_type:            (raw.job_type as JobType) ?? 'routine',
    zone_id:             Number(raw.zone_id ?? 0),
    zone_name:           (raw.zone_name as string) ?? `Zone ${raw.zone_id ?? '?'}`,
    state:               (raw.state as JobState),
    priority:            (raw.priority as number) ?? 0,
    assigned_vehicle_id: (raw.assigned_vehicle_id as string | null) ?? null,
    assigned_driver_id:  (raw.assigned_driver_id as string | null) ?? null,
    clusters:            (raw.clusters as string[]) ?? [],
    planned_weight_kg:   raw.planned_weight_kg != null ? Number(raw.planned_weight_kg) : null,
    actual_weight_kg:    (raw.actual_weight_kg as number | null) ?? null,
    bins_total:          (raw.bins_total as number) ?? binsToCollect.length,
    bins_collected:      (raw.bins_collected as number) ?? 0,
    bins_skipped:        (raw.bins_skipped as number) ?? 0,
    created_at:          (raw.created_at as string),
    completed_at:        (raw.completed_at as string | null) ?? null,
    duration_minutes:    (raw.duration_minutes as number | null) ?? null,
  }
}

export async function getJobs(
  api: KyInstance,
  params?: {
    state?:    string
    job_type?: string
    zone_id?:  number
    page?:     number
    limit?:    number
  },
) {
  const raw = await api
    .get('api/v1/collection-jobs', { searchParams: params ?? {} })
    .json<{ data: Record<string, unknown>[]; total: number; page: number }>()
  return { ...raw, data: raw.data.map(normalizeJob) }
}

export async function getJob(api: KyInstance, jobId: string) {
  return api.get(`api/v1/collection-jobs/${jobId}`).json<CollectionJobDetail>()
}

export async function cancelJob(api: KyInstance, jobId: string, reason: string) {
  return api
    .post(`api/v1/collection-jobs/${jobId}/cancel`, { json: { reason } })
    .json()
}

export async function getJobProgress(api: KyInstance, collectionId: string) {
  return api
    .get(`api/v1/collections/${collectionId}/progress`)
    .json<JobProgress>()
}
