import type { KyInstance } from 'ky'
import type { CollectionJobListItem, CollectionJobDetail } from '@/types'

export interface CreateJobRequest {
  job_type?:      'emergency' | 'routine'
  zone_id:        string
  waste_category?: string
  bin_ids?:       string[]
  urgency_score?: number
}

export async function createJob(api: KyInstance, body: CreateJobRequest) {
  return api
    .post('api/v1/collection-jobs', { json: body })
    .json<{ job_id: string; state: string }>()
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
