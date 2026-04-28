import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../db/queries';

beforeEach(() => db.clearAll());

describe('createJob', () => {
  it('creates a job with CREATED state and correct fields', () => {
    const job = db.createJob({ job_type: 'emergency', zone_id: 1, trigger_bin_id: 'B1', trigger_urgency_score: 85 });
    expect(job.state).toBe('CREATED');
    expect(job.id).toMatch(/^JOB-/);
    expect(job.job_type).toBe('emergency');
    expect(job.zone_id).toBe(1);
    expect(job.trigger_bin_id).toBe('B1');
    expect(job.clusters).toEqual([]);
    expect(job.bins_to_collect).toEqual([]);
  });

  it('stores job so getJob can retrieve it', () => {
    const job = db.createJob({ job_type: 'routine', zone_id: 2 });
    expect(db.getJob(job.id)).toBe(job);
  });
});

describe('updateJobState', () => {
  it('changes the state of the job', () => {
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.updateJobState(job.id, 'BIN_CONFIRMING');
    expect(db.getJob(job.id)!.state).toBe('BIN_CONFIRMING');
  });
});

describe('insertStateTransition', () => {
  it('records transition and exposes it via getJobDetail', () => {
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.insertStateTransition({ job_id: job.id, from_state: 'CREATED', to_state: 'BIN_CONFIRMING', reason: 'test' });
    const detail = db.getJobDetail(job.id)!;
    expect(detail.state_history).toHaveLength(1);
    expect(detail.state_history[0]).toMatchObject({
      from_state: 'CREATED', to_state: 'BIN_CONFIRMING', reason: 'test',
    });
  });
});

describe('insertStepResult', () => {
  it('records step result and exposes it via getJobDetail', () => {
    const job = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.insertStepResult({ job_id: job.id, step_name: 'dispatch', attempt_number: 1, success: true, duration_ms: 150 });
    const detail = db.getJobDetail(job.id)!;
    expect(detail.step_log).toHaveLength(1);
    expect(detail.step_log[0]).toMatchObject({ step_name: 'dispatch', success: true, duration_ms: 150 });
  });
});

describe('listJobs', () => {
  it('returns empty list with page/limit when no jobs', () => {
    expect(db.listJobs()).toMatchObject({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('sorts by created_at descending', async () => {
    const j1 = db.createJob({ job_type: 'emergency', zone_id: 1 });
    await new Promise(r => setTimeout(r, 5));
    const j2 = db.createJob({ job_type: 'routine', zone_id: 1 });
    const { data } = db.listJobs();
    expect(data[0].id).toBe(j2.id);
    expect(data[1].id).toBe(j1.id);
  });

  it('filters by job_type', () => {
    db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.createJob({ job_type: 'routine', zone_id: 1 });
    expect(db.listJobs({ job_type: 'routine' }).total).toBe(1);
  });

  it('filters by state', () => {
    const j = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.updateJobState(j.id, 'CANCELLED');
    db.createJob({ job_type: 'emergency', zone_id: 1 });
    expect(db.listJobs({ state: 'CANCELLED' }).total).toBe(1);
  });

  it('paginates results', () => {
    for (let i = 0; i < 5; i++) db.createJob({ job_type: 'emergency', zone_id: 1 });
    const { data, total } = db.listJobs({ page: 2, limit: 2 });
    expect(total).toBe(5);
    expect(data).toHaveLength(2);
  });
});

describe('getStats', () => {
  it('returns zeroed stats with no jobs', () => {
    const s = db.getStats({});
    expect(s.total_jobs).toBe(0);
    expect(s.completion_rate_pct).toBe(0);
  });

  it('correctly counts completed, escalated, cancelled', () => {
    const j1 = db.createJob({ job_type: 'emergency', zone_id: 1 });
    const j2 = db.createJob({ job_type: 'routine',   zone_id: 1 });
    const j3 = db.createJob({ job_type: 'emergency', zone_id: 1 });
    db.updateJobState(j1.id, 'COMPLETED');
    db.updateJobState(j2.id, 'ESCALATED');
    db.updateJobState(j3.id, 'CANCELLED');
    const s = db.getStats({});
    expect(s.total_jobs).toBe(3);
    expect(s.completed_jobs).toBe(1);
    expect(s.escalated_jobs).toBe(1);
    expect(s.cancelled_jobs).toBe(1);
    expect(s.completion_rate_pct).toBeCloseTo(33.3, 0);
  });
});
