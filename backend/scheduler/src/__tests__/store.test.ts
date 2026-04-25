import { describe, it, expect, beforeEach } from 'vitest';
import {
  drivers, vehicles, jobProgress,
  findAvailableDriver, findAvailableVehicle,
  assignJob, releaseJob,
  recordBinCollected, recordBinSkipped,
  resetStore,
} from '../store';

beforeEach(() => resetStore());

describe('findAvailableDriver', () => {
  it('prefers a same-zone driver', () => {
    const driver = findAvailableDriver('Zone-2');
    expect(driver?.zone_id).toBe('Zone-2');
  });

  it('falls back to any available driver when no zone match', () => {
    // mark all Zone-X drivers unavailable except one from a different zone
    drivers.forEach(d => { if (d.zone_id !== 'Zone-1') d.available = false; });
    const driver = findAvailableDriver('Zone-3');
    expect(driver).toBeDefined();
    expect(driver?.zone_id).toBe('Zone-1');
  });

  it('returns undefined when all drivers are unavailable', () => {
    drivers.forEach(d => { d.available = false; });
    expect(findAvailableDriver('Zone-1')).toBeUndefined();
  });

  it('excludes specified driver ids', () => {
    const exclude = [...drivers.keys()].slice(0, 4); // exclude all but last
    const driver = findAvailableDriver('Zone-1', exclude);
    expect(driver).toBeDefined();
    expect(exclude).not.toContain(driver!.driver_id);
  });
});

describe('findAvailableVehicle', () => {
  it('finds a vehicle that supports the category', () => {
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

describe('assignJob', () => {
  it('marks driver and vehicle as unavailable and creates progress entry', () => {
    const progress = assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    expect(progress.job_id).toBe('JOB-1');
    expect(progress.current_cargo_kg).toBe(0);
    expect(drivers.get('DRV-001')!.available).toBe(false);
    expect(vehicles.get('LORRY-01')!.available).toBe(false);
    expect(jobProgress.get('JOB-1')).toBeDefined();
  });
});

describe('releaseJob', () => {
  it('frees driver and vehicle after job release', () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    releaseJob('JOB-1');
    expect(drivers.get('DRV-001')!.available).toBe(true);
    expect(vehicles.get('LORRY-01')!.available).toBe(true);
  });

  it('is a no-op for unknown job_id', () => {
    expect(() => releaseJob('NOPE')).not.toThrow();
  });
});

describe('recordBinCollected', () => {
  it('adds a collected entry and increments cargo', () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const ok = recordBinCollected('JOB-1', 'B1', 120);
    expect(ok).toBe(true);
    const p = jobProgress.get('JOB-1')!;
    expect(p.bin_statuses[0].status).toBe('collected');
    expect(p.current_cargo_kg).toBe(120);
  });

  it('returns false for unknown job', () => {
    expect(recordBinCollected('NOPE', 'B1', 100)).toBe(false);
  });
});

describe('recordBinSkipped', () => {
  it('adds a skipped entry with reason', () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const ok = recordBinSkipped('JOB-1', 'B1', 'blocked road');
    expect(ok).toBe(true);
    expect(jobProgress.get('JOB-1')!.bin_statuses[0]).toMatchObject({ status: 'skipped', skipped_reason: 'blocked road' });
  });

  it('returns false for unknown job', () => {
    expect(recordBinSkipped('NOPE', 'B1', 'reason')).toBe(false);
  });
});
