import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createJob, transition, clearAll } from '../store';
import { acceptJob, completeJob, cancelJob, handleDriverResponse } from '../state-machine/machine';

vi.mock('../clients/bin-status', () => ({
  confirmUrgency: vi.fn(),
  markCollected:  vi.fn(),
}));
vi.mock('../clients/scheduler', () => ({
  assignDriver:  vi.fn(),
  releaseDriver: vi.fn(),
}));
vi.mock('../clients/notification', () => ({
  notifyJobAssigned:  vi.fn(),
  notifyJobCancelled: vi.fn(),
  notifyJobEscalated: vi.fn(),
}));

import { markCollected } from '../clients/bin-status';
import { releaseDriver, assignDriver } from '../clients/scheduler';
import { notifyJobCancelled, notifyJobEscalated } from '../clients/notification';

beforeEach(() => {
  clearAll();
  vi.clearAllMocks();
});

describe('acceptJob', () => {
  it('returns true and transitions to IN_PROGRESS when AWAITING_ACCEPTANCE', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'BIN_CONFIRMING');
    transition(job, 'BIN_CONFIRMED');
    transition(job, 'ROUTE_LOADING');
    transition(job, 'ROUTE_LOADED');
    transition(job, 'ASSIGNING_DRIVER');
    transition(job, 'DRIVER_ASSIGNED');
    transition(job, 'NOTIFYING_DRIVER');
    transition(job, 'DRIVER_NOTIFIED');
    transition(job, 'AWAITING_ACCEPTANCE');

    const ok = await acceptJob(job);
    expect(ok).toBe(true);
    expect(job.state).toBe('IN_PROGRESS');
  });

  it('returns false when job is not in AWAITING_ACCEPTANCE', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const ok = await acceptJob(job);
    expect(ok).toBe(false);
    expect(job.state).toBe('CREATED');
  });
});

describe('completeJob', () => {
  it('returns true, marks bins collected, releases driver, transitions to COMPLETED', async () => {
    vi.mocked(markCollected).mockResolvedValue(true);
    vi.mocked(releaseDriver).mockResolvedValue();

    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: ['B1', 'B2'] });
    job.driver_id  = 'DRV-001';
    job.vehicle_id = 'LORRY-01';
    transition(job, 'IN_PROGRESS');

    const ok = await completeJob(job);
    expect(ok).toBe(true);
    expect(job.state).toBe('COMPLETED');
    expect(markCollected).toHaveBeenCalledTimes(2);
    expect(releaseDriver).toHaveBeenCalledWith(job.job_id);
    expect(job.completed_at).toBeDefined();
  });

  it('returns false when job is not IN_PROGRESS', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    const ok = await completeJob(job);
    expect(ok).toBe(false);
  });
});

describe('cancelJob', () => {
  it('cancels a job that is in a non-terminal state', async () => {
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(notifyJobCancelled).mockResolvedValue(true);

    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'ASSIGNING_DRIVER');
    job.driver_id = 'DRV-001';

    const ok = await cancelJob(job, 'supervisor override');
    expect(ok).toBe(true);
    expect(job.state).toBe('CANCELLED');
    expect(releaseDriver).toHaveBeenCalledWith(job.job_id);
    expect(notifyJobCancelled).toHaveBeenCalled();
  });

  it('returns false for already-terminal states', async () => {
    for (const terminalState of ['COMPLETED', 'FAILED', 'CANCELLED'] as const) {
      clearAll();
      const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
      transition(job, terminalState);
      expect(await cancelJob(job, 'reason')).toBe(false);
    }
  });
});

describe('handleDriverResponse', () => {
  it('transitions to IN_PROGRESS on acceptance', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    job.driver_id = 'DRV-001';
    transition(job, 'AWAITING_ACCEPTANCE');

    await handleDriverResponse(job, 'accepted');
    expect(job.state).toBe('IN_PROGRESS');
  });

  it('escalates after max rejections', async () => {
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(notifyJobCancelled).mockResolvedValue(true);
    vi.mocked(notifyJobEscalated).mockResolvedValue(true);
    vi.mocked(assignDriver).mockResolvedValue(null); // no replacement driver

    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    job.driver_id = 'DRV-001';
    job.driver_rejection_count = 2; // one away from MAX_DRIVER_RETRIES (3)
    transition(job, 'AWAITING_ACCEPTANCE');

    await handleDriverResponse(job, 'rejected', 'unavailable');
    expect(job.state).toBe('ESCALATED');
    expect(notifyJobEscalated).toHaveBeenCalled();
  });

  it('does nothing when job is not AWAITING_ACCEPTANCE', async () => {
    const job = createJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general', bin_ids: [] });
    transition(job, 'IN_PROGRESS');
    await handleDriverResponse(job, 'accepted');
    // state should remain IN_PROGRESS, not double-transition
    expect(job.state).toBe('IN_PROGRESS');
  });
});
