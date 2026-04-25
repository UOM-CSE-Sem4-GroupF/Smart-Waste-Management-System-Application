import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../routes/internal';

vi.mock('../socket', () => ({
  emitToRoom: vi.fn(),
  setSocketServer: vi.fn(),
}));

import { emitToRoom } from '../socket';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /internal/notify/job-assigned', () => {
  it('emits job:status to driver room and dashboard-all', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-assigned',
      payload: {
        job_id: 'JOB-1', driver_id: 'DRV-001', vehicle_id: 'LORRY-01',
        zone_id: 'Z1', waste_category: 'general', estimated_bins: 5,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().delivered).toBe(true);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:status', expect.objectContaining({ event: 'job_assigned' }));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all',  'job:status', expect.objectContaining({ job_id: 'JOB-1' }));
  });
});

describe('POST /internal/notify/job-cancelled', () => {
  it('emits job_cancelled to driver and dashboard when driver_id provided', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: { job_id: 'JOB-1', reason: 'no route', driver_id: 'DRV-002' },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-002', 'job:status', expect.objectContaining({ event: 'job_cancelled' }));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all',  'job:status', expect.objectContaining({ event: 'job_cancelled' }));
  });

  it('only emits to dashboard when driver_id is absent', async () => {
    await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-cancelled',
      payload: { job_id: 'JOB-1', reason: 'no route' },
    });
    const driverCalls = vi.mocked(emitToRoom).mock.calls.filter(([room]) => room.startsWith('driver-'));
    expect(driverCalls).toHaveLength(0);
  });
});

describe('POST /internal/notify/route-updated', () => {
  it('emits route_updated to driver and dashboard', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/route-updated',
      payload: { job_id: 'JOB-1', driver_id: 'DRV-001', route_id: 'RT-99' },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('driver-DRV-001', 'job:status', expect.objectContaining({ event: 'route_updated', route_id: 'RT-99' }));
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all',  'job:status', expect.objectContaining({ event: 'route_updated' }));
  });
});

describe('POST /internal/notify/job-escalated', () => {
  it('emits alert:urgent to dashboard-all', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/notify/job-escalated',
      payload: { job_id: 'JOB-1', zone_id: 'Z1', reason: 'no drivers' },
    });
    expect(res.statusCode).toBe(200);
    expect(emitToRoom).toHaveBeenCalledWith('dashboard-all', 'alert:urgent', expect.objectContaining({ event: 'job_escalated', job_id: 'JOB-1' }));
  });
});
