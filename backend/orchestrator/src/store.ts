import { CollectionJob, JobType, JobState, StateTransition, StepResult } from './types';

const jobs = new Map<string, CollectionJob>();

export function createJob(params: {
  job_type:      JobType;
  zone_id:       string;
  waste_category: string;
  bin_ids:       string[];
  urgency_score?: number;
  route_id?:     string;
}): CollectionJob {
  const job_id = `JOB-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const now    = new Date().toISOString();
  const job: CollectionJob = {
    job_id,
    job_type:               params.job_type,
    state:                  'CREATED',
    zone_id:                params.zone_id,
    waste_category:         params.waste_category,
    bin_ids:                params.bin_ids,
    urgency_score:          params.urgency_score,
    route_id:               params.route_id,
    driver_rejection_count: 0,
    created_at:             now,
    updated_at:             now,
    state_history:          [],
    step_results:           [],
  };
  jobs.set(job_id, job);
  return job;
}

export function transition(job: CollectionJob, to: JobState, reason?: string): void {
  job.state_history.push({ from: job.state, to, at: new Date().toISOString(), reason });
  job.state      = to;
  job.updated_at = new Date().toISOString();
}

export function recordStep(job: CollectionJob, step: string, success: boolean, detail?: unknown): void {
  job.step_results.push({ step, success, at: new Date().toISOString(), detail });
}

export function getJob(id: string): CollectionJob | undefined { return jobs.get(id); }

export function getAllJobs(filters: { state?: string; page?: number; limit?: number } = {}): { data: CollectionJob[]; total: number } {
  let list = [...jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters.state) list = list.filter(j => j.state === filters.state);
  const total = list.length;
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  return { data: list.slice((page - 1) * limit, page * limit), total };
}
