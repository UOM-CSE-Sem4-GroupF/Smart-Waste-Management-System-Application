import { describe, it, expect, beforeEach } from 'vitest';
import { drivers, vehicles, activeJobs, findAvailableVehicle, resetStore } from '../store';

beforeEach(() => resetStore());

describe('resetStore', () => {
  it('re-seeds 5 drivers and 5 vehicles', () => {
    expect(drivers.size).toBe(5);
    expect(vehicles.size).toBe(5);
  });

  it('clears activeJobs', () => {
    activeJobs.set('JOB-X', {
      job_id: 'JOB-X', state: 'DISPATCHED',
      assigned_vehicle_id: 'LORRY-01', assigned_driver_id: 'DRV-001',
      zone_id: 1, waste_category: 'general', total_bins: 2, created_at: new Date().toISOString(),
    });
    resetStore();
    expect(activeJobs.size).toBe(0);
  });
});

describe('findAvailableVehicle', () => {
  it('finds a vehicle that supports the waste category', () => {
    const v = findAvailableVehicle('glass', 100);
    expect(v).toBeDefined();
    expect(v?.waste_categories_supported).toContain('glass');
  });

  it('returns undefined for unsupported category', () => {
    expect(findAvailableVehicle('radioactive', 100)).toBeUndefined();
  });

  it('returns undefined when weight exceeds all vehicles', () => {
    expect(findAvailableVehicle('general', 999_999)).toBeUndefined();
  });

  it('returns the smallest sufficient vehicle', () => {
    const v = findAvailableVehicle('general', 100);
    expect(v).toBeDefined();
    // smallest general vehicle is LORRY-01 (2000 kg)
    expect(v?.max_cargo_kg).toBeLessThanOrEqual(8000);
  });

  it('skips unavailable vehicles', () => {
    vehicles.forEach(v => { v.status = 'dispatched'; });
    expect(findAvailableVehicle('general', 100)).toBeUndefined();
  });
});
