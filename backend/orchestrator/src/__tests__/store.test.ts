import { describe, it, expect, beforeEach } from 'vitest';
import { createJob, transition, recordStep, getJob, getAllJobs, clearAll } from '../store';

beforeEach(() => clearAll());

describe('createJob', () => {
  it('creates a job with CREATED state and correct fields', () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: ['B1', 'B2'] });
    expect(job.state).toBe('CREATED');
    expect(job.job_type).toBe('emergency');
    expect(job.zone_id).toBe('Z1');
    expect(job.bin_ids).toEqual(['B1', 'B2']);
    expect(job.driver_rejection_count).toBe(0);
    expect(job.state_history).toHaveLength(0);
    expect(job.step_results).toHaveLength(0);
    expect(job.job_id).toMatch(/^JOB-/);
  });

  it('stores job so getJob can retrieve it', () => {
    const job = createJob({ job_type: 'routine', zone_id: 'Z2', waste_category: 'paper', bin_ids: [] });
    expect(getJob(job.job_id)).toBe(job);
  });
});

describe('transition', () => {
  it('updates job state and appends to state_history', () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'BIN_CONFIRMING');
    expect(job.state).toBe('BIN_CONFIRMING');
    expect(job.state_history).toHaveLength(1);
    expect(job.state_history[0]).toMatchObject({ from: 'CREATED', to: 'BIN_CONFIRMING' });
  });

  it('records optional reason in transition', () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'CANCELLED', 'test reason');
    expect(job.state_history[0].reason).toBe('test reason');
  });
});

describe('recordStep', () => {
  it('appends step result to the job', () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    recordStep(job, 'confirm-urgency:B1', true, { bin_id: 'B1' });
    expect(job.step_results).toHaveLength(1);
    expect(job.step_results[0]).toMatchObject({ step: 'confirm-urgency:B1', success: true });
  });
});

describe('getAllJobs', () => {
  it('returns empty when no jobs', () => {
    expect(getAllJobs()).toEqual({ data: [], total: 0 });
  });

  it('sorts by created_at descending', async () => {
    const j1 = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    await new Promise(r => setTimeout(r, 5));
    const j2 = createJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const { data } = getAllJobs();
    expect(data[0].job_id).toBe(j2.job_id);
    expect(data[1].job_id).toBe(j1.job_id);
  });

  it('filters by state', () => {
    const j1 = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const j2 = createJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(j2, 'CANCELLED');
    const { data, total } = getAllJobs({ state: 'CANCELLED' });
    expect(total).toBe(1);
    expect(data[0].job_id).toBe(j2.job_id);
  });

  it('paginates results', () => {
    for (let i = 0; i < 5; i++) {
      createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    }
    const { data, total } = getAllJobs({ page: 2, limit: 2 });
    expect(total).toBe(5);
    expect(data).toHaveLength(2);
  });
});
