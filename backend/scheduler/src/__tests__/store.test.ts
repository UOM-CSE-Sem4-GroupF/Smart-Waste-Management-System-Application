import { describe, it, expect, beforeEach } from 'vitest';
import {
  drivers, vehicles,
  clearAll,
  findAvailableDriver,
  findSmallestSufficientVehicle,
  findAvailableVehicle,
  assignJob,
  releaseJob,
  getJobAssignment,
  createBinCollectionRecords,
  updateBinCollected,
  updateBinSkipped,
  getJobProgressSummary,
  getJobCargoKg,
} from '../db/queries';

beforeEach(() => clearAll());

describe('findAvailableDriver', () => {
  it('prefers a same-zone driver', () => {
    const d = findAvailableDriver('Zone-2');
    expect(d?.zone_id).toBe('Zone-2');
  });

  it('falls back to any available driver when no zone match', () => {
    drivers.forEach(d => { if (d.zone_id !== 'Zone-1') d.available = false; });
    const d = findAvailableDriver('Zone-3');
    expect(d).toBeDefined();
    expect(d?.zone_id).toBe('Zone-1');
  });

  it('returns undefined when all drivers are unavailable', () => {
    drivers.forEach(d => { d.available = false; });
    expect(findAvailableDriver('Zone-1')).toBeUndefined();
  });

  it('excludes specified driver ids', () => {
    const exclude = [...drivers.keys()].slice(0, 4);
    const d = findAvailableDriver('Zone-1', exclude);
    expect(d).toBeDefined();
    expect(exclude).not.toContain(d!.driver_id);
  });
});

describe('findSmallestSufficientVehicle', () => {
  it('returns the smallest vehicle that meets weight and category', () => {
    const v = findSmallestSufficientVehicle('general', 100);
    // LORRY-03 (4000 kg) is smallest supporting 'general' (LORRY-01=5000, LORRY-04=6000, LORRY-03=4000)
    expect(v).toBeDefined();
    expect(v!.waste_categories).toContain('general');
  });

  it('skips vehicles below min_kg', () => {
    const v = findSmallestSufficientVehicle('general', 4500);
    // LORRY-03 (4000 kg) is too small — should be LORRY-01 (5000 kg)
    expect(v).toBeDefined();
    expect(v!.max_cargo_kg).toBeGreaterThanOrEqual(4500);
  });

  it('returns undefined when no vehicle supports the category', () => {
    expect(findSmallestSufficientVehicle('radioactive', 100)).toBeUndefined();
  });

  it('returns undefined when all supporting vehicles are unavailable', () => {
    vehicles.forEach(v => { v.available = false; });
    expect(findSmallestSufficientVehicle('general', 100)).toBeUndefined();
  });
});

describe('findAvailableVehicle', () => {
  it('finds a vehicle supporting the category', () => {
    const v = findAvailableVehicle('glass', 100);
    expect(v).toBeDefined();
    expect(v?.waste_categories).toContain('glass');
  });

  it('returns undefined for unsupported category', () => {
    expect(findAvailableVehicle('radioactive', 100)).toBeUndefined();
  });

  it('ignores unavailable vehicles', () => {
    vehicles.forEach(v => { v.available = false; });
    expect(findAvailableVehicle('general', 100)).toBeUndefined();
  });
});

describe('assignJob / releaseJob', () => {
  it('marks driver and vehicle unavailable and stores assignment', () => {
    const a = assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    expect(a.job_id).toBe('JOB-1');
    expect(a.planned_weight_kg).toBe(500);
    expect(drivers.get('DRV-001')!.available).toBe(false);
    expect(vehicles.get('LORRY-01')!.available).toBe(false);
    expect(getJobAssignment('JOB-1')).toBeDefined();
  });

  it('releaseJob restores availability', () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    releaseJob('JOB-1');
    expect(drivers.get('DRV-001')!.available).toBe(true);
    expect(vehicles.get('LORRY-01')!.available).toBe(true);
  });

  it('releaseJob is a no-op for unknown job', () => {
    expect(() => releaseJob('NOPE')).not.toThrow();
  });
});

describe('createBinCollectionRecords / updateBinCollected / updateBinSkipped', () => {
  beforeEach(() => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    createBinCollectionRecords('JOB-1', [
      { bin_id: 'B1', cluster_id: 'C1', lat: 6.9, lng: 79.8, sequence_number: 1, estimated_weight_kg: 100, planned_arrival_at: null },
      { bin_id: 'B2', cluster_id: 'C1', lat: 6.9, lng: 79.8, sequence_number: 2, estimated_weight_kg: 150, planned_arrival_at: null },
    ]);
  });

  it('creates records with pending status', () => {
    const p = getJobProgressSummary('JOB-1')!;
    expect(p.bins_pending).toBe(2);
    expect(p.bins_collected).toBe(0);
  });

  it('updateBinCollected changes status and accumulates cargo', () => {
    updateBinCollected('JOB-1', 'B1', { actual_weight_kg: 90 });
    const p = getJobProgressSummary('JOB-1')!;
    expect(p.bins_collected).toBe(1);
    expect(getJobCargoKg('JOB-1')).toBe(90);
  });

  it('updateBinSkipped changes status', () => {
    updateBinSkipped('JOB-1', 'B1', { skip_reason: 'locked' });
    const p = getJobProgressSummary('JOB-1')!;
    expect(p.bins_skipped).toBe(1);
    expect(p.bin_statuses.find(b => b.bin_id === 'B1')?.skip_reason).toBe('locked');
  });

  it('job_complete is true when all bins resolved', () => {
    updateBinCollected('JOB-1', 'B1', {});
    updateBinSkipped('JOB-1', 'B2', { skip_reason: 'inaccessible' });
    expect(getJobProgressSummary('JOB-1')!.job_complete).toBe(true);
  });
});

describe('getJobProgressSummary', () => {
  it('returns undefined for unknown job', () => {
    expect(getJobProgressSummary('NOPE')).toBeUndefined();
  });

  it('calculates cargo_utilisation_pct correctly', () => {
    assignJob('JOB-2', 'DRV-001', 'LORRY-01', 500);  // LORRY-01 = 5000 kg
    createBinCollectionRecords('JOB-2', [
      { bin_id: 'B1', cluster_id: 'C1', lat: 6.9, lng: 79.8, sequence_number: 1, estimated_weight_kg: 2500, planned_arrival_at: null },
    ]);
    updateBinCollected('JOB-2', 'B1', { actual_weight_kg: 2500 });
    const p = getJobProgressSummary('JOB-2')!;
    expect(p.cargo_utilisation_pct).toBe(50);
  });
});
