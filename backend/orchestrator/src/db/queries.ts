import { CollectionJob, JobType, JobState, StateTransition, StepResult } from '../types';
import { validateTransition } from '../core/stateMachine';

const jobs            = new Map<string, CollectionJob>();
const stateHistory    = new Map<string, StateTransition[]>();
const stepLog         = new Map<string, StepResult[]>();

export function insertJob(params: {
  job_type:       JobType;
  zone_id:        string;
  waste_category: string;
  trigger_bin_id?:        string;
  trigger_urgency_score?: number;
  schedule_id?:           string;
  kafka_offset?:          number;
}): CollectionJob {
  const job_id = `JOB-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const now    = new Date().toISOString();
  const job: CollectionJob = {
    job_id,
    job_type:               params.job_type,
    state:                  'CREATED',
    zone_id:                params.zone_id,
    waste_category:         params.waste_category,
    trigger_bin_id:         params.trigger_bin_id,
    trigger_urgency_score:  params.trigger_urgency_score,
    clusters:               [],
    bins_to_collect:        [],
    schedule_id:            params.schedule_id,
    kafka_offset:           params.kafka_offset,
    created_at:             now,
  };
  jobs.set(job_id, job);
  stateHistory.set(job_id, []);
  stepLog.set(job_id, []);
  return job;
}

export function getJob(id: string): CollectionJob | undefined {
  return jobs.get(id);
}

export function updateJob(job: CollectionJob, patch: Partial<Omit<CollectionJob, 'job_id' | 'job_type' | 'created_at' | 'state'>>): void {
  Object.assign(job, patch);
}

export function transition(job: CollectionJob, to: JobState, reason?: string, actor = 'system'): void {
  validateTransition(job.state, to);
  const record: StateTransition = {
    from_state:       job.state,
    to_state:         to,
    reason,
    actor,
    transitioned_at:  new Date().toISOString(),
  };
  stateHistory.get(job.job_id)?.push(record);
  job.state = to;
}

export function recordStep(
  job: CollectionJob,
  step_name: string,
  attempt_number: number,
  success: boolean,
  duration_ms: number,
  error_message?: string,
): void {
  const record: StepResult = {
    step_name,
    attempt_number,
    success,
    duration_ms,
    error_message,
    executed_at: new Date().toISOString(),
  };
  stepLog.get(job.job_id)?.push(record);
}

export function getStateHistory(job_id: string): StateTransition[] {
  return stateHistory.get(job_id) ?? [];
}

export function getStepLog(job_id: string): StepResult[] {
  return stepLog.get(job_id) ?? [];
}

export function hasActiveJobForBin(bin_id: string): boolean {
  const terminal = new Set<JobState>(['COMPLETED', 'CANCELLED', 'FAILED', 'ESCALATED']);
  for (const job of jobs.values()) {
    if (!terminal.has(job.state) && (job.trigger_bin_id === bin_id || job.bins_to_collect.includes(bin_id))) {
      return true;
    }
  }
  return false;
}

export function getJobs(filters: {
  job_type?:  string;
  state?:     string;
  zone_id?:   string;
  date_from?: string;
  date_to?:   string;
  page?:      number;
  limit?:     number;
} = {}): { data: CollectionJob[]; total: number; page: number; limit: number } {
  let list = [...jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (filters.job_type) list = list.filter(j => j.job_type === filters.job_type);
  if (filters.state)    list = list.filter(j => j.state    === filters.state);
  if (filters.zone_id)  list = list.filter(j => j.zone_id  === filters.zone_id);
  if (filters.date_from) list = list.filter(j => j.created_at >= filters.date_from!);
  if (filters.date_to)   list = list.filter(j => j.created_at <= filters.date_to!);

  const total = list.length;
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  return {
    data:  list.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
  };
}

export function getStats(filters: {
  date_from?: string;
  date_to?:   string;
  zone_id?:   string;
} = {}): {
  total_jobs:                  number;
  emergency_jobs:              number;
  routine_jobs:                number;
  completed_jobs:              number;
  escalated_jobs:              number;
  cancelled_jobs:              number;
  completion_rate_pct:         number;
  avg_duration_minutes:        number;
  avg_bins_per_job:            number;
  avg_weight_per_job_kg:       number;
  emergency_vs_routine_ratio:  number;
} {
  let list = [...jobs.values()];
  if (filters.date_from) list = list.filter(j => j.created_at >= filters.date_from!);
  if (filters.date_to)   list = list.filter(j => j.created_at <= filters.date_to!);
  if (filters.zone_id)   list = list.filter(j => j.zone_id  === filters.zone_id);

  const total      = list.length;
  const emergency  = list.filter(j => j.job_type === 'emergency').length;
  const routine    = list.filter(j => j.job_type === 'routine').length;
  const completed  = list.filter(j => j.state === 'COMPLETED').length;
  const escalated  = list.filter(j => j.state === 'ESCALATED').length;
  const cancelled  = list.filter(j => j.state === 'CANCELLED').length;

  const doneJobs = list.filter(j => j.state === 'COMPLETED' && j.actual_duration_min != null);
  const avgDuration = doneJobs.length > 0
    ? doneJobs.reduce((s, j) => s + (j.actual_duration_min ?? 0), 0) / doneJobs.length
    : 0;

  const avgBins = total > 0
    ? list.reduce((s, j) => s + j.bins_to_collect.length, 0) / total
    : 0;

  const weightJobs = list.filter(j => j.actual_weight_kg != null);
  const avgWeight = weightJobs.length > 0
    ? weightJobs.reduce((s, j) => s + (j.actual_weight_kg ?? 0), 0) / weightJobs.length
    : 0;

  return {
    total_jobs:                 total,
    emergency_jobs:             emergency,
    routine_jobs:               routine,
    completed_jobs:             completed,
    escalated_jobs:             escalated,
    cancelled_jobs:             cancelled,
    completion_rate_pct:        total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
    avg_duration_minutes:       parseFloat(avgDuration.toFixed(1)),
    avg_bins_per_job:           parseFloat(avgBins.toFixed(1)),
    avg_weight_per_job_kg:      parseFloat(avgWeight.toFixed(2)),
    emergency_vs_routine_ratio: routine > 0 ? parseFloat((emergency / routine).toFixed(2)) : emergency,
  };
}

export function clearAll(): void {
  jobs.clear();
  stateHistory.clear();
  stepLog.clear();
}
