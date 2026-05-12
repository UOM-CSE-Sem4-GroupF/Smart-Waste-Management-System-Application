import type { KyInstance } from 'ky'
import type { CollectionJobListItem, CollectionJobDetail, JobProgress, JobType, JobState } from '@/types'

export interface CreateJobRequest {
  job_type?:       'emergency' | 'routine'
  zone_id:         string
  waste_category?: string
  bin_ids?:        string[]
  urgency_score?:  number
}

// Raw shape the orchestrator actually returns (uses job_id, not id)
interface RawJob {
  job_id:               string
  job_type:             string
  state:                string
  zone_id:              string
  clusters:             string[]
  bins_to_collect:      string[]
  planned_weight_kg?:   number | null
  actual_weight_kg?:    number | null
  assigned_vehicle_id?: string | null
  assigned_driver_id?:  string | null
  created_at:           string
  completed_at?:        string | null
  actual_duration_min?: number | null
}

function normalizeJob(raw: RawJob): CollectionJobListItem {
  return {
    id:                  raw.job_id,
    job_type:            raw.job_type as JobType,
    zone_id:             parseInt(raw.zone_id, 10),
    zone_name:           `Zone ${raw.zone_id}`,
    state:               raw.state as JobState,
    priority:            raw.job_type === 'emergency' ? 9 : 5,
    assigned_vehicle_id: raw.assigned_vehicle_id ?? null,
    assigned_driver_id:  raw.assigned_driver_id  ?? null,
    clusters:            raw.clusters,
    planned_weight_kg:   raw.planned_weight_kg   ?? null,
    actual_weight_kg:    raw.actual_weight_kg    ?? null,
    bins_total:          (raw.bins_to_collect ?? []).length,
    bins_collected:      0,
    bins_skipped:        0,
    created_at:          raw.created_at,
    completed_at:        raw.completed_at        ?? null,
    duration_minutes:    raw.actual_duration_min ?? null,
  }
}

// Proxied through Next.js API route to avoid browser CORS/proxy restrictions
export async function createJob(body: CreateJobRequest): Promise<{ job_id: string; state: string }> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { reason?: string }
    throw new Error(err.reason ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ job_id: string; state: string }>
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
  // The server-side state filter is broken (returns 0 results), so strip it
  // and filter client-side instead. Fetch up to 100 to cover all tabs.
  const { state, ...serverParams } = params ?? {}
  const raw = await api
    .get('api/v1/collection-jobs', {
      searchParams: { ...serverParams, limit: serverParams.limit ?? 100 },
    })
    .json<{ data: RawJob[]; total: number; page: number }>()

  let jobs = raw.data.map(normalizeJob)
  if (state) {
    const states = state.split(',').map(s => s.trim()).filter(Boolean)
    jobs = jobs.filter(j => states.includes(j.state))
  }
  return { ...raw, data: jobs }
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
