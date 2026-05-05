import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../routes/internal';

vi.mock('../socket', () => ({
  emitToRoom: vi.fn(),
  findConnectedSocket: vi.fn(() => null), // Default: driver not connected
  setSocketServer: vi.fn(),
}));

vi.mock('../fcm', () => ({
  sendPush: vi.fn(),
}));

import { emitToRoom, findConnectedSocket } from '../socket';
import { sendPush } from '../fcm';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findConnectedSocket).mockReturnValue(null); // Driver not connected by default
});

describe('POST /internal/notify/job-assigned', () => {
  it('emits job:assigned to driver room and sends FCM', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        driver_id: 'DRV-001',
        vehicle_id: 'LORRY-01',
        job_id: 'JOB-1',
        job_type: 'emergency',
        clusters: [],
        route: [],
        estimated_duration_min: 30,
        planned_weight_kg: 500,
        total_bins: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:assigned', expect.objectContaining({ job_id: 'JOB-1' }));
    expect(sendPush).toHaveBeenCalledWith('DRV-001', expect.any(Object), expect.any(Object));
  });

  it('does not send FCM when driver is connected to Socket.IO', async () => {
    vi.mocked(findConnectedSocket).mockReturnValue('socket-123');

    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        driver_id: 'DRV-001',
        vehicle_id: 'LORRY-01',
        job_id: 'JOB-1',
        job_type: 'routine',
        clusters: [],
        route: [],
        estimated_duration_min: 30,
        planned_weight_kg: 500,
        total_bins: 5,
      },
    });

    expect(sendPush).not.toHaveBeenCalled();
  });
});

describe('POST /internal/notify/job-created', () => {
  it('emits job:created to zone and fleet-ops rooms', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-created',
      payload: {
        job_id: 'JOB-1',
        job_type: 'routine',
        zone_id: 1,
        zone_name: 'South',
        clusters: ['C1', 'C2'],
        vehicle_id: 'LORRY-01',
        driver_id: 'DRV-001',
        total_bins: 10,
        planned_weight_kg: 800,
        priority: 1,
        route: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:created', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:created', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('fleet-ops', 'job:created', expect.any(Object));
  });
});

describe('POST /internal/notify/job-completed', () => {
  it('emits to dashboard and driver, sends FCM when driver not connected', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-completed',
      payload: {
        job_id: 'JOB-1',
        zone_id: 1,
        vehicle_id: 'LORRY-01',
        driver_id: 'DRV-001',
        bins_collected: 10,
        bins_skipped: 0,
        actual_weight_kg: 800,
        duration_minutes: 120,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'job:completed', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:completed', expect.any(Object));
    expect(sendPush).toHaveBeenCalledWith('DRV-001', expect.any(Object), expect.any(Object));
  });
});

describe('POST /internal/notify/job-cancelled', () => {
  it('emits to driver and dashboard when driver_id provided', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: {
        job_id: 'JOB-1',
        zone_id: 1,
        reason: 'operator request',
        driver_id: 'DRV-001',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:cancelled', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'job:cancelled', expect.any(Object));
  });

  it('only emits to dashboard when driver_id is absent', async () => {
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: {
        job_id: 'JOB-1',
        zone_id: 1,
        reason: 'operator request',
      },
    });
    const driverCalls = vi.mocked(emitToRoom).mock.calls.filter(([room]) => room.startsWith('driver-'));
    expect(driverCalls).toHaveLength(0);
  });
});

describe('POST /internal/notify/job-escalated', () => {
  it('emits alert:escalated to dashboard and alerts rooms', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-escalated',
      payload: {
        job_id: 'JOB-1',
        zone_id: 1,
        reason: 'no drivers available',
        urgent_bins: [{ bin_id: 'B1', urgency_score: 85 }],
        total_weight_kg: 500,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:escalated', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:escalated', expect.any(Object));
  });
});

describe('POST /internal/notify/vehicle-position', () => {
  it('emits vehicle:position to zone, dashboard, and fleet-ops', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/vehicle-position',
      payload: {
        vehicle_id: 'LORRY-01',
        driver_id: 'DRV-001',
        job_id: 'JOB-1',
        zone_id: 1,
        lat: 6.9,
        lng: 79.8,
        speed_kmh: 40,
        cargo_weight_kg: 500,
        cargo_limit_kg: 1000,
        cargo_utilisation_pct: 50,
        bins_collected: 5,
        bins_total: 10,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'vehicle:position', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'vehicle:position', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('fleet-ops', 'vehicle:position', expect.any(Object));
  });

  it('emits weight-limit alert when cargo_utilisation_pct > 90', async () => {
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/vehicle-position',
      payload: {
        vehicle_id: 'LORRY-01',
        driver_id: 'DRV-001',
        job_id: 'JOB-1',
        zone_id: 1,
        lat: 6.9,
        lng: 79.8,
        speed_kmh: 40,
        cargo_weight_kg: 950,
        cargo_limit_kg: 1000,
        cargo_utilisation_pct: 95,
        bins_collected: 9,
        bins_total: 10,
        weight_limit_warning: true,
      },
    });

    const weightAlerts = vi.mocked(emitToRoom).mock.calls.filter(([, event]) => event === 'alert:weight-limit');
    expect(weightAlerts.length).toBeGreaterThan(0);
  });
});

describe('POST /internal/notify/alert-deviation', () => {
  it('emits alert:deviation to fleet-ops and zone rooms', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/alert-deviation',
      payload: {
        vehicle_id: 'LORRY-01',
        driver_id: 'DRV-001',
        job_id: 'JOB-1',
        zone_id: 1,
        deviation_metres: 500,
        duration_seconds: 60,
        message: 'Vehicle off route by 500m for 60 seconds',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('fleet-ops', 'alert:deviation', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-zone-1', 'alert:deviation', expect.any(Object));
    expect(emitToRoom).toHaveBeenCalledWith('alerts-all', 'alert:deviation', expect.any(Object));
  });
});

