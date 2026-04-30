import { describe, it, expect, beforeEach, vi } from 'vitest';
import { insertJob, clearAll, getStateHistory } from '../db/queries';

vi.mock('../clients/binStatusClient', () => ({
  getClusterSnapshot: vi.fn(),
  scanNearby:         vi.fn(),
  markCollected:      vi.fn(),
}));
vi.mock('../clients/schedulerClient', () => ({
  dispatch:      vi.fn(),
  releaseDriver: vi.fn(),
}));
vi.mock('../clients/notificationClient', () => ({
  notifyDashboard: vi.fn(),
}));
vi.mock('../clients/hyperledgerClient', () => ({
  recordAudit: vi.fn(),
}));
vi.mock('../kafka/producer', () => ({
  publishJobCompleted: vi.fn(),
  getProducer:         vi.fn(),
}));

import { markCollected } from '../clients/binStatusClient';
import { releaseDriver } from '../clients/schedulerClient';
import { notifyDashboard } from '../clients/notificationClient';
import { recordAudit } from '../clients/hyperledgerClient';
import { publishJobCompleted } from '../kafka/producer';
import { completeJob, cancelJob } from '../core/orchestrator';
import { JobCompleteRequest } from '../types';

const makeCompleteRequest = (bin_ids: string[]): JobCompleteRequest => ({
  job_id:      'ignored',
  vehicle_id:  'VEH-01',
  driver_id:   'DRV-01',
  bins_collected: bin_ids.map(bid => ({
    bin_id: bid, collected_at: new Date().toISOString(),
    fill_level_at_collection: 80, gps_lat: 0, gps_lng: 0,
  })),
  bins_skipped:       [],
  actual_weight_kg:   100,
  actual_distance_km: 5,
  route_gps_trail:    [],
});

beforeEach(() => {
  clearAll();
  vi.clearAllMocks();
});

describe('completeJob', () => {
  it('runs full completion path: marks bins, audits, publishes, notifies', async () => {
    vi.mocked(markCollected).mockResolvedValue(true);
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(recordAudit).mockResolvedValue({ tx_id: 'TX-001' });
    vi.mocked(publishJobCompleted).mockResolvedValue();
    vi.mocked(notifyDashboard).mockResolvedValue();

    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state            = 'IN_PROGRESS';
    job.bins_to_collect  = ['BIN-001', 'BIN-002'];
    job.assigned_driver_id  = 'DRV-01';
    job.assigned_vehicle_id = 'VEH-01';

    await completeJob(job, makeCompleteRequest(['BIN-001', 'BIN-002']));

    expect(job.state).toBe('COMPLETED');
    expect(job.completed_at).toBeDefined();
    expect(job.hyperledger_tx_id).toBe('TX-001');
    expect(markCollected).toHaveBeenCalledTimes(2);
    expect(releaseDriver).toHaveBeenCalledWith(job.job_id);
    expect(publishJobCompleted).toHaveBeenCalledOnce();
    expect(notifyDashboard).toHaveBeenCalledWith('job-completed', expect.objectContaining({ job_id: job.job_id }));

    const history = getStateHistory(job.job_id).map(h => h.to_state);
    expect(history).toContain('COMPLETING');
    expect(history).toContain('COLLECTION_DONE');
    expect(history).toContain('RECORDING_AUDIT');
    expect(history).toContain('AUDIT_RECORDED');
    expect(history).toContain('COMPLETED');
  });

  it('handles Hyperledger failure gracefully — still reaches COMPLETED via AUDIT_FAILED', async () => {
    vi.mocked(markCollected).mockResolvedValue(true);
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(recordAudit).mockRejectedValue(new Error('Hyperledger offline'));
    vi.mocked(publishJobCompleted).mockResolvedValue();
    vi.mocked(notifyDashboard).mockResolvedValue();

    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state           = 'IN_PROGRESS';
    job.bins_to_collect = ['BIN-001'];

    await completeJob(job, makeCompleteRequest(['BIN-001']));

    expect(job.state).toBe('COMPLETED');
    const history = getStateHistory(job.job_id).map(h => h.to_state);
    expect(history).toContain('AUDIT_FAILED');
    expect(history).toContain('COMPLETED');
    expect(history).not.toContain('AUDIT_RECORDED');
  });

  it('throws when job is not IN_PROGRESS', async () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    await expect(completeJob(job, makeCompleteRequest([]))).rejects.toThrow('Cannot complete job in state CREATED');
  });
});

describe('cancelJob', () => {
  it('cancels a job in DISPATCHED state', async () => {
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(notifyDashboard).mockResolvedValue();

    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state               = 'DISPATCHED';
    job.assigned_driver_id  = 'DRV-01';

    const ok = await cancelJob(job, 'supervisor override');
    expect(ok).toBe(true);
    expect(job.state).toBe('CANCELLED');
    expect(releaseDriver).toHaveBeenCalledWith(job.job_id);
    expect(notifyDashboard).toHaveBeenCalledWith('job-cancelled', expect.any(Object));
  });

  it('returns false when job is IN_PROGRESS', async () => {
    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state = 'IN_PROGRESS';
    expect(await cancelJob(job, 'reason')).toBe(false);
  });

  it('returns false for terminal states', async () => {
    for (const s of ['COMPLETED', 'FAILED', 'CANCELLED', 'ESCALATED'] as const) {
      clearAll();
      const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
      job.state = s;
      expect(await cancelJob(job, 'reason')).toBe(false);
    }
  });

  it('cancels without driver notification when no driver assigned', async () => {
    vi.mocked(releaseDriver).mockResolvedValue();
    vi.mocked(notifyDashboard).mockResolvedValue();

    const job = insertJob({ job_type: 'emergency', zone_id: 'Z1', waste_category: 'general' });
    job.state = 'BIN_CONFIRMING';

    const ok = await cancelJob(job, 'bin no longer urgent');
    expect(ok).toBe(true);
    expect(releaseDriver).not.toHaveBeenCalled();
    expect(notifyDashboard).not.toHaveBeenCalled();
  });
});
