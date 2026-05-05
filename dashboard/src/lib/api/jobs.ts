import type { KyInstance } from 'ky'
import type { CollectionJobListItem, CollectionJobDetail } from '@/types'

export async function getJobs(
  api: KyInstance,
  params?: {
    state?:     string
    job_type?:  string
    zone_id?:   number
    date_from?: string
    date_to?:   string
    page?:      number
    limit?:     number
  },
) {
  return api
    .get('api/v1/collection-jobs', { searchParams: params ?? {} })
    .json<{ data: CollectionJobListItem[]; total: number; page: number }>()
}

export async function getJob(api: KyInstance, jobId: string) {
  return api.get(`api/v1/collection-jobs/${jobId}`).json<CollectionJobDetail>()
}

export async function cancelJob(api: KyInstance, jobId: string, reason: string) {
  return api
    .post(`api/v1/collection-jobs/${jobId}/cancel`, { json: { reason } })
    .json()
}

export async function getJobStats(
  api: KyInstance,
  params: { date_from: string; date_to: string; zone_id?: number },
) {
  return api
    .get('api/v1/collection-jobs/stats', { searchParams: params as unknown as Record<string, string> })
    .json()
}

export async function getJobProgress(jobId: string, api: KyInstance) {
  return api.get(`api/v1/jobs/${jobId}/progress`).json()
}
