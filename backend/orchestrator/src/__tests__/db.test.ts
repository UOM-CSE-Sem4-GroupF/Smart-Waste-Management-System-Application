import { describe, it, expect, beforeEach } from 'vitest';
import { insertJob, transition, recordStep, getJob, getJobs, getStats, getStateHistory, getStepLog, hasActiveJobForBin, clearAll } from '../db/queries';
import { CollectionJob } from '../types';

beforeEach(() => clearAll());

describe('insertJob', () => {
  it('creates a job with CREATED state and correct fields', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    expect(job.state).toBe('CREATED');
    expect(job.job_type).toBe('emergency');
    expect(job.zone_id).toBe('Z1');
    expect(job.clusters).toEqual([]);
    expect(job.bins_to_collect).toEqual([]);
    expect(job.job_id).toMatch(/^JOB-/);
  });

  it('stores job retrievable via getJob', () => {
    const job = insertJob({ job_type: 'routine', zone_id: 'Z2', waste_category: 'paper' });
    expect(getJob(job.job_id)).toBe(job);
  });

  it('initialises separate state history and step log entries', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    expect(getStateHistory(job.job_id)).toEqual([]);
    expect(getStepLog(job.job_id)).toEqual([]);
  });
});

describe('transition', () => {
  it('updates job state and records in state history', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    transition(job, 'BIN_CONFIRMING');
    expect(job.state).toBe('BIN_CONFIRMING');
    const history = getStateHistory(job.job_id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ from_state: 'CREATED', to_state: 'BIN_CONFIRMING', actor: 'system' });
  });

  it('records optional reason', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    transition(job, 'CLUSTER_ASSEMBLING', 'routine skip');
    expect(getStateHistory(job.job_id)[0].reason).toBe('routine skip');
  });

  it('throws on invalid transition', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    expect(() => transition(job, 'COMPLETED')).toThrow('Invalid transition');
  });
});

describe('recordStep', () => {
  it('appends to step log', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    recordStep(job, 'bin_confirmation', 1, true, 120);
    const log = getStepLog(job.job_id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ step_name: 'bin_confirmation', attempt_number: 1, success: true, duration_ms: 120 });
  });

  it('records error message on failure', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    recordStep(job, 'dispatch', 1, false, 500, 'timeout');
    expect(getStepLog(job.job_id)[0].error_message).toBe('timeout');
  });
});

describe('getJobs', () => {
  it('returns empty when no jobs', () => {
    expect(getJobs()).toMatchObject({ data: [], total: 0 });
  });

  it('sorts by created_at descending', async () => {
    const j1 = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    await new Promise(r => setTimeout(r, 5));
    const j2 = insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    const { data } = getJobs();
    expect(data[0].job_id).toBe(j2.job_id);
    expect(data[1].job_id).toBe(j1.job_id);
  });

  it('filters by job_type', () => {
    insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    const { total } = getJobs({ job_type: 'routine' });
    expect(total).toBe(1);
  });

  it('filters by zone_id', () => {
    insertJob({ job_type: 'emergency', zone_id: 'Zone-1', waste_category: 'general' });
    insertJob({ job_type: 'emergency', zone_id: 'Zone-2', waste_category: 'general' });
    const { total } = getJobs({ zone_id: 'Zone-1' });
    expect(total).toBe(1);
  });

  it('filters by state using direct mutation for test setup', () => {
    const j1 = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    j2.state = 'CANCELLED'; // direct mutation for test setup
    const { data, total } = getJobs({ state: 'CANCELLED' });
    expect(total).toBe(1);
    expect(data[0].job_id).toBe(j2.job_id);
  });

  it('paginates results', () => {
    for (let i = 0; i < 5; i++) insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const { data, total, page, limit } = getJobs({ page: 2, limit: 2 });
    expect(total).toBe(5);
    expect(data).toHaveLength(2);
    expect(page).toBe(2);
    expect(limit).toBe(2);
  });
});

describe('getStats', () => {
  it('returns zeros when no jobs', () => {
    const stats = getStats();
    expect(stats.total_jobs).toBe(0);
    expect(stats.completion_rate_pct).toBe(0);
  });

  it('counts by type and state', () => {
    const j1 = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    const j2 = insertJob({ job_type: 'routine',   zone_id: 'Z1', waste_category: 'general' });
    j1.state = 'COMPLETED';
    j2.state = 'ESCALATED';
    const stats = getStats();
    expect(stats.total_jobs).toBe(2);
    expect(stats.emergency_jobs).toBe(1);
    expect(stats.routine_jobs).toBe(1);
    expect(stats.completed_jobs).toBe(1);
    expect(stats.escalated_jobs).toBe(1);
    expect(stats.completion_rate_pct).toBe(50);
  });
});

describe('hasActiveJobForBin', () => {
  it('returns true when non-terminal job has the bin in bins_to_collect', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', trigger_bin_id: 'BIN-001' });
    job.bins_to_collect = ['BIN-001'];
    expect(hasActiveJobForBin('BIN-001')).toBe(true);
  });

  it('returns true for trigger_bin_id', () => {
    insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', trigger_bin_id: 'BIN-042' });
    expect(hasActiveJobForBin('BIN-042')).toBe(true);
  });

  it('returns false after job completes', () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', trigger_bin_id: 'BIN-007' });
    job.state = 'COMPLETED';
    expect(hasActiveJobForBin('BIN-007')).toBe(false);
  });

  it('returns false when no jobs exist for bin', () => {
    expect(hasActiveJobForBin('BIN-999')).toBe(false);
  });
});
