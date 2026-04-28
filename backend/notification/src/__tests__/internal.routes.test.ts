import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../routes/internal';

vi.mock('../socket', () => ({
  emitToRoom:        vi.fn(),
  emitToRooms:       vi.fn(),
  isDriverConnected: vi.fn().mockResolvedValue(true),
  setSocketServer:   vi.fn(),
}));

vi.mock('../fcm', () => ({ sendPush: vi.fn() }));

import { emitToRoom, emitToRooms, isDriverConnected } from '../socket';
import { sendPush } from '../fcm';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /internal/notify/job-assigned', () => {
  it('emits job:assigned to driver room', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        driver_id: 'DRV-001', vehicle_id: 'LORRY-01', job_id: 'JOB-1',
        job_type: 'routine', clusters: [], route: [],
        estimated_duration_min: 45, planned_weight_kg: 500, total_bins: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().delivered).toBe(true);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:assigned', expect.objectContaining({ job_id: 'JOB-1' }));
  });

  it('sends FCM push when driver is not connected', async () => {
    vi.mocked(isDriverConnected).mockResolvedValueOnce(false);
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        driver_id: 'DRV-002', vehicle_id: 'LORRY-02', job_id: 'JOB-2',
        job_type: 'emergency', clusters: [], route: [],
        estimated_duration_min: 30, planned_weight_kg: 300, total_bins: 3,
      },
    });
    expect(sendPush).toHaveBeenCalledWith(
      'DRV-002',
      expect.objectContaining({ title: 'New collection job assigned' }),
      expect.objectContaining({ job_id: 'JOB-2', job_type: 'emergency' }),
    );
  });

  it('does not send FCM when driver is connected', async () => {
    vi.mocked(isDriverConnected).mockResolvedValueOnce(true);
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        driver_id: 'DRV-003', vehicle_id: 'LORRY-03', job_id: 'JOB-3',
        job_type: 'routine', clusters: [], route: [],
        estimated_duration_min: 60, planned_weight_kg: 400, total_bins: 8,
      },
    });
    expect(sendPush).not.toHaveBeenCalled();
  });
});

describe('POST /internal/notify/job-created', () => {
  it('emits job:created to zone, dashboard-all, and fleet-ops', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-created',
      payload: {
        job_id: 'JOB-1', job_type: 'routine', zone_id: 1, zone_name: 'Zone 1',
        clusters: [], vehicle_id: 'V1', driver_id: 'D1',
        total_bins: 5, planned_weight_kg: 300, priority: 2, route: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all', 'fleet-ops'],
      'job:created',
      expect.objectContaining({ job_id: 'JOB-1' }),
    );
  });
});

describe('POST /internal/notify/job-completed', () => {
  it('emits job:completed to dashboard rooms and driver room', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-completed',
      payload: {
        job_id: 'JOB-1', zone_id: 1, vehicle_id: 'V1', driver_id: 'DRV-001',
        bins_collected: 10, bins_skipped: 1, actual_weight_kg: 450,
        duration_minutes: 40, hyperledger_tx_id: null,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all', 'fleet-ops'],
      'job:completed',
      expect.any(Object),
    );
    expect(emitToRoom).toHaveBeenCalledWith(
      'driver-DRV-001',
      'job:completed',
      expect.objectContaining({ job_id: 'JOB-1', message: 'Job complete. Well done!' }),
    );
  });
});

describe('POST /internal/notify/job-escalated', () => {
  it('emits alert:escalated to dashboard and alerts-all with message', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-escalated',
      payload: { job_id: 'JOB-1', zone_id: 1, reason: 'no vehicle', urgent_bins: [], total_weight_kg: 500 },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all', 'alerts-all'],
      'alert:escalated',
      expect.objectContaining({
        job_id: 'JOB-1',
        message: 'Emergency collection needs manual dispatch — no vehicle available',
      }),
    );
  });
});

describe('POST /internal/notify/job-cancelled', () => {
  it('emits job:cancelled to dashboard and driver when driver_id present', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: { job_id: 'JOB-1', zone_id: 1, driver_id: 'DRV-001', reason: 'no route' },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(['dashboard-zone-1', 'dashboard-all'], 'job:cancelled', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:cancelled', expect.any(Object));
  });

  it('only emits to dashboard when driver_id is null', async () => {
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: { job_id: 'JOB-1', zone_id: 1, driver_id: null, reason: 'timeout' },
    });
    expect(emitToRooms).toHaveBeenCalledWith(['dashboard-zone-1', 'dashboard-all'], 'job:cancelled', expect.any(Object));
    const driverCalls = vi.mocked(emitToRoom).mock.calls.filter(([room]) => room.startsWith('driver-'));
    expect(driverCalls).toHaveLength(0);
  });
});

describe('POST /internal/notify/vehicle-position', () => {
  it('emits vehicle:position to zone, dashboard-all, and fleet-ops', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/vehicle-position',
      payload: {
        vehicle_id: 'V1', driver_id: 'D1', job_id: 'JOB-1', zone_id: 1,
        lat: 6.9, lng: 79.8, speed_kmh: 30,
        cargo_weight_kg: 300, cargo_limit_kg: 500, cargo_utilisation_pct: 60,
        bins_collected: 5, bins_total: 10,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(
      ['dashboard-zone-1', 'dashboard-all', 'fleet-ops'],
      'vehicle:position',
      expect.any(Object),
    );
  });

  it('emits alert:weight-limit when weight_limit_warning is true', async () => {
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/vehicle-position',
      payload: {
        vehicle_id: 'V1', driver_id: 'D1', job_id: 'JOB-1', zone_id: 1,
        lat: 6.9, lng: 79.8, speed_kmh: 20,
        cargo_weight_kg: 460, cargo_limit_kg: 500, cargo_utilisation_pct: 92,
        bins_collected: 9, bins_total: 10, weight_limit_warning: true,
      },
    });
    const weightCalls = vi.mocked(emitToRooms).mock.calls.filter(([, event]) => event === 'alert:weight-limit');
    expect(weightCalls).toHaveLength(1);
    expect(weightCalls[0][0]).toEqual(['fleet-ops', 'dashboard-all']);
  });
});

describe('POST /internal/notify/alert-deviation', () => {
  it('emits alert:deviation to fleet-ops, zone, and alerts-all', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/alert-deviation',
      payload: {
        vehicle_id: 'V1', driver_id: 'D1', job_id: 'JOB-1', zone_id: 1,
        deviation_metres: 500, duration_seconds: 120, message: 'Off route',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRooms).toHaveBeenCalledWith(
      ['fleet-ops', 'dashboard-zone-1', 'alerts-all'],
      'alert:deviation',
      expect.any(Object),
    );
  });
});
