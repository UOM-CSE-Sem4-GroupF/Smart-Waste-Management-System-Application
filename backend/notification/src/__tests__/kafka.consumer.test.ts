import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handle } from '../kafka/consumer';

vi.mock('../socket', () => ({
  emitToRoom: vi.fn(),
}));

import { emitToRoom } from '../socket';

const TS = '2024-01-01T00:00:00.000Z';

beforeEach(() => vi.clearAllMocks());

describe('waste.bin.dashboard.updates', () => {
  describe('bin:update events', () => {
    it('emits bin:update to zone and dashboard-all rooms', () => {
      const event = {
        event_type: 'bin:update' as const,
        payload: {
          bin_id: 'B1',
          zone_id: 1,
          fill_level_pct: 60,
          urgency_score: 60,
        },
      };
      handle('waste.bin.dashboard.updates', event, TS);

      expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'bin:update', expect.objectContaining({ bin_id: 'B1' }));
      expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'bin:update', expect.objectContaining({ bin_id: 'B1' }));
    });
  });

  describe('zone:stats events', () => {
    it('emits zone:stats to zone-specific and all rooms', () => {
      const event = {
        event_type: 'zone:stats' as const,
        payload: {
          zone_id: 1,
          avg_fill: 65,
          total_bins: 50,
        },
      };
      handle('waste.bin.dashboard.updates', event, TS);

      expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'zone:stats', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'zone:stats', expect.any(Object));
    });
  });

  describe('alert:urgent events', () => {
    it('emits alert:urgent to zone, dashboard, and alerts rooms', () => {
      const event = {
        event_type: 'alert:urgent' as const,
        payload: {
          zone_id: 1,
          bin_id: 'B1',
          urgency_score: 90,
        },
      };
      handle('waste.bin.dashboard.updates', event, TS);

      expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'alert:urgent', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:urgent', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:urgent', expect.any(Object));
    });
  });
});

describe('waste.vehicle.dashboard.updates', () => {
  describe('vehicle:position events', () => {
    it('emits vehicle:position to zone, dashboard, and fleet-ops', () => {
      const event = {
        event_type: 'vehicle:position' as const,
        payload: {
          vehicle_id: 'V1',
          zone_id: 1,
          lat: 6.9,
          lng: 79.8,
          speed_kmh: 40,
        },
      };
      handle('waste.vehicle.dashboard.updates', event, TS);

      expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'vehicle:position', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'vehicle:position', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('fleet-ops', 'vehicle:position', expect.any(Object));
    });
  });

  describe('job:progress events', () => {
    it('emits job:progress to zone and dashboard-all', () => {
      const event = {
        event_type: 'job:progress' as const,
        payload: {
          job_id: 'JOB-1',
          zone_id: 1,
          vehicle_id: 'V1',
          bins_collected: 5,
          bins_total: 10,
        },
      };
      handle('waste.vehicle.dashboard.updates', event, TS);

      expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:progress', expect.any(Object));
      expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:progress', expect.any(Object));
    });
  });
});

