import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleBinEvent, handleVehicleEvent } from '../kafka/consumer';

vi.mock('../socket', () => ({
  emitToRoom:  vi.fn(),
  emitToRooms: vi.fn(),
  emitToAll:   vi.fn(),
}));

import { emitToRooms } from '../socket';

beforeEach(() => vi.clearAllMocks());

describe('handleBinEvent — bin:update', () => {
  it('emits to zone room and dashboard-all', () => {
    handleBinEvent({ event_type: 'bin:update', payload: { zone_id: 1, bin_id: 'B1' } });
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all'],
      'bin:update',
      expect.objectContaining({ bin_id: 'B1' }),
    );
  });
});

describe('handleBinEvent — zone:stats', () => {
  it('emits to zone room and dashboard-all', () => {
    handleBinEvent({ event_type: 'zone:stats', payload: { zone_id: 2, avg_fill: 60 } });
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-2', 'dashboard-all'],
      'zone:stats',
      expect.any(Object),
    );
  });
});

describe('handleBinEvent — alert:urgent', () => {
  it('emits to zone room, dashboard-all, and alerts-all', () => {
    handleBinEvent({ event_type: 'alert:urgent', payload: { zone_id: 3, bin_id: 'B2', urgency_score: 95 } });
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-3', 'dashboard-all', 'alerts-all'],
      'alert:urgent',
      expect.any(Object),
    );
  });
});

describe('handleVehicleEvent — vehicle:position', () => {
  it('emits to zone room, dashboard-all, and fleet-ops', () => {
    handleVehicleEvent({ event_type: 'vehicle:position', payload: { zone_id: 1, vehicle_id: 'V1' } });
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all', 'fleet-ops'],
      'vehicle:position',
      expect.any(Object),
    );
  });
});

describe('handleVehicleEvent — job:progress', () => {
  it('emits to zone room and dashboard-all', () => {
    handleVehicleEvent({ event_type: 'job:progress', payload: { zone_id: 1, job_id: 'JOB-1' } });
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all'],
      'job:progress',
      expect.any(Object),
    );
  });
});
