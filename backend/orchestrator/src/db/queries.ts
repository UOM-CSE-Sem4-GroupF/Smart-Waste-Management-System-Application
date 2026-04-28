import {
  CollectionJob, JobType, JobState,
  BinCollectionRecord, StateTransitionRecord, StepResultRecord,
} from '../types';

const jobs            = new Map<string, CollectionJob>();
const binCollections  = new Map<string, BinCollectionRecord[]>();
const stateTransitions = new Map<string, StateTransitionRecord[]>();
const stepResults     = new Map<string, StepResultRecord[]>();

export function createJob(params: {
  job_type: JobType;
  zone_id: number;
  zone_name?: string;
  trigger_bin_id?: string;
  trigger_urgency_score?: number;
  trigger_waste_category?: string;
  schedule_id?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  route_plan_id?: string;
  kafka_offset?: string;
  priority?: number;
}): CollectionJob {
  const id  = `JOB-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const job: CollectionJob = {
    id,
    job_type:               params.job_type,
    zone_id:                params.zone_id,
    zone_name:              params.zone_name,
    state:                  'CREATED',
    priority:               params.priority ?? 3,
    trigger_bin_id:         params.trigger_bin_id,
    trigger_urgency_score:  params.trigger_urgency_score,
    trigger_waste_category: params.trigger_waste_category,
    schedule_id:            params.schedule_id,
    scheduled_date:         params.scheduled_date,
    scheduled_time:         params.scheduled_time,
    route_plan_id:          params.route_plan_id,
    clusters:               [],
    bins_to_collect:        [],
    kafka_offset:           params.kafka_offset,
    created_at:             now,
    updated_at:             now,
  };
  jobs.set(id, job);
  binCollections.set(id, []);
  stateTransitions.set(id, []);
  stepResults.set(id, []);
  return job;
}

export function getJob(id: string): CollectionJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<CollectionJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, updates);
  job.updated_at = new Date().toISOString();
}

export function updateJobState(id: string, state: JobState): void {
  const job = jobs.get(id);
  if (!job) return;
  job.state      = state;
  job.updated_at = new Date().toISOString();
}

export function insertStateTransition(params: {
  job_id: string;
  from_state: string | null;
  to_state: string;
  reason?: string;
  actor?: string;
}): void {
  const list = stateTransitions.get(params.job_id) ?? [];
  list.push({
    job_id:          params.job_id,
    from_state:      params.from_state,
    to_state:        params.to_state,
    reason:          params.reason,
    actor:           params.actor ?? 'system',
    transitioned_at: new Date().toISOString(),
  });
  stateTransitions.set(params.job_id, list);
}

export function insertStepResult(params: {
  job_id: string;
  step_name: string;
  attempt_number: number;
  success: boolean;
  duration_ms: number;
  error_message?: string;
}): void {
  const list = stepResults.get(params.job_id) ?? [];
  list.push({ ...params, executed_at: new Date().toISOString() });
  stepResults.set(params.job_id, list);
}

export function upsertBinCollection(params: BinCollectionRecord & { job_id: string }): void {
  const { job_id, ...record } = params;
  const list = binCollections.get(job_id) ?? [];
  const idx  = list.findIndex(b => b.bin_id === record.bin_id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  binCollections.set(job_id, list);
}

export function getJobDetail(id: string): (CollectionJob & {
  bin_collections: BinCollectionRecord[];
  state_history: StateTransitionRecord[];
  step_log: StepResultRecord[];
}) | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  return {
    ...job,
    bin_collections: binCollections.get(id)   ?? [],
    state_history:   stateTransitions.get(id) ?? [],
    step_log:        stepResults.get(id)       ?? [],
  };
}

export function listJobs(filters: {
  job_type?:  string;
  state?:     string;
  zone_id?:   number;
  date_from?: string;
  date_to?:   string;
  page?:      number;
  limit?:     number;
} = {}): { data: CollectionJob[]; total: number; page: number; limit: number } {
  let list = [...jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (filters.job_type)      list = list.filter(j => j.job_type === filters.job_type);
  if (filters.state)         list = list.filter(j => j.state    === filters.state);
  if (filters.zone_id != null) list = list.filter(j => j.zone_id === filters.zone_id);
  if (filters.date_from)     list = list.filter(j => j.created_at >= filters.date_from!);
  if (filters.date_to)       list = list.filter(j => j.created_at <= filters.date_to!);

  const total = list.length;
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  return { data: list.slice((page - 1) * limit, page * limit), total, page, limit };
}

export function getStats(filters: {
  zone_id?:   number;
  date_from?: string;
  date_to?:   string;
}): {
  total_jobs: number;
  emergency_jobs: number;
  routine_jobs: number;
  completed_jobs: number;
  escalated_jobs: number;
  cancelled_jobs: number;
  completion_rate_pct: number;
  avg_duration_minutes: number;
  avg_bins_per_job: number;
  avg_weight_per_job_kg: number;
  emergency_vs_routine_ratio: number;
} {
  let list = [...jobs.values()];
  if (filters.zone_id != null) list = list.filter(j => j.zone_id === filters.zone_id);
  if (filters.date_from) list = list.filter(j => j.created_at >= filters.date_from!);
  if (filters.date_to)   list = list.filter(j => j.created_at <= filters.date_to!);

  const total     = list.length;
  const emergency = list.filter(j => j.job_type === 'emergency').length;
  const routine   = list.filter(j => j.job_type === 'routine').length;
  const completed = list.filter(j => j.state === 'COMPLETED').length;
  const escalated = list.filter(j => j.state === 'ESCALATED').length;
  const cancelled = list.filter(j => j.state === 'CANCELLED').length;

  const doneJobs  = list.filter(j => j.actual_duration_min != null);
  const avgDur    = doneJobs.length
    ? doneJobs.reduce((s, j) => s + j.actual_duration_min!, 0) / doneJobs.length : 0;

  const binsTotal = list.reduce((s, j) => s + j.bins_to_collect.length, 0);
  const avgBins   = total ? binsTotal / total : 0;

  const wJobs    = list.filter(j => j.actual_weight_kg != null);
  const avgWeight = wJobs.length
    ? wJobs.reduce((s, j) => s + j.actual_weight_kg!, 0) / wJobs.length : 0;

  return {
    total_jobs:                 total,
    emergency_jobs:             emergency,
    routine_jobs:               routine,
    completed_jobs:             completed,
    escalated_jobs:             escalated,
    cancelled_jobs:             cancelled,
    completion_rate_pct:        total ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
    avg_duration_minutes:       parseFloat(avgDur.toFixed(1)),
    avg_bins_per_job:           parseFloat(avgBins.toFixed(1)),
    avg_weight_per_job_kg:      parseFloat(avgWeight.toFixed(1)),
    emergency_vs_routine_ratio: routine ? parseFloat((emergency / routine).toFixed(2)) : 0,
  };
}

export function clearAll(): void {
  jobs.clear();
  binCollections.clear();
  stateTransitions.clear();
  stepResults.clear();
}
