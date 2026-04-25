import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handle } from '../kafka/consumer';

vi.mock('../socket', () => ({
  emitToRoom: vi.fn(),
  emitToAll:  vi.fn(),
}));

import { emitToRoom, emitToAll } from '../socket';

const TS = '2024-01-01T00:00:00.000Z';

beforeEach(() => vi.clearAllMocks());

describe('waste.bin.processed', () => {
  it('emits bin:update to dashboard-all', () => {
    handle('waste.bin.processed', { bin_id: 'B1', urgency_score: 50, fill_level_pct: 50 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'bin:update', expect.objectContaining({ bin_id: 'B1' }));
  });

  it('also emits alert:urgent when urgency_score >= 80', () => {
    handle('waste.bin.processed', { bin_id: 'B1', urgency_score: 85, fill_level_pct: 85 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:urgent', expect.objectContaining({ bin_id: 'B1', urgency_score: 85 }));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'bin:update', expect.any(Object));
  });

  it('does not emit alert:urgent when urgency_score < 80', () => {
    handle('waste.bin.processed', { bin_id: 'B1', urgency_score: 79, fill_level_pct: 79 }, TS);
    const urgentCalls = vi.mocked(emitToRoom).mock.calls.filter(([, event]) => event === 'alert:urgent');
    expect(urgentCalls).toHaveLength(0);
  });
});

describe('waste.bin.status.changed', () => {
  it('broadcasts bin:update to all clients', () => {
    handle('waste.bin.status.changed', { bin_id: 'B1', collection_status: 'collecting' }, TS);
    expect(emitToAll).toHaveBeenCalledWith('bin:update', expect.objectContaining({ bin_id: 'B1' }));
  });
});

describe('waste.vehicle.location', () => {
  it('emits vehicle:position to fleet-ops and dashboard-all', () => {
    handle('waste.vehicle.location', { vehicle_id: 'V1', lat: 6.9, lng: 79.8 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('fleet-ops',     'vehicle:position', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'vehicle:position', expect.any(Object));
  });

  it('also emits to driver room when driver_id is present', () => {
    handle('waste.vehicle.location', { vehicle_id: 'V1', driver_id: 'DRV-001', lat: 6.9, lng: 79.8 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'vehicle:position', expect.any(Object));
  });
});

describe('waste.vehicle.deviation', () => {
  it('emits alert:deviation to fleet-ops only', () => {
    handle('waste.vehicle.deviation', { vehicle_id: 'V1', deviation_metres: 500 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('fleet-ops', 'alert:deviation', expect.any(Object));
    const dashboardCalls = vi.mocked(emitToRoom).mock.calls.filter(([room]) => room === 'dashboard-all');
    expect(dashboardCalls).toHaveLength(0);
  });
});

describe('waste.zone.statistics', () => {
  it('emits zone:stats to zone-specific room and dashboard-all', () => {
    handle('waste.zone.statistics', { zone_id: 'Z1', avg_fill: 60 }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-Z1', 'zone:stats', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all',     'zone:stats', expect.any(Object));
  });
});

describe('waste.job.completed', () => {
  it('emits job:status COMPLETED to dashboard-all', () => {
    handle('waste.job.completed', { job_id: 'JOB-1' }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:status', expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('also emits to driver room when driver_id is present', () => {
    handle('waste.job.completed', { job_id: 'JOB-1', driver_id: 'DRV-002' }, TS);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-002', 'job:status', expect.any(Object));
  });
});
