import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../routes/internal';
import { drivers, vehicles, resetStore } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => resetStore());

describe('POST /internal/scheduler/assign', () => {
  it('assigns an available driver and vehicle, returns their ids', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/scheduler/assign',
      payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 200 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.driver_id).toBeDefined();
    expect(body.vehicle_id).toBeDefined();
    expect(body.assigned_at).toBeDefined();
    // driver should now be marked unavailable
    expect(drivers.get(body.driver_id)!.available).toBe(false);
  });

  it('returns 409 when no driver is available', async () => {
    drivers.forEach(d => { d.available = false; });
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/scheduler/assign',
      payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 200 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NO_DRIVER_AVAILABLE');
  });

  it('returns 409 when no vehicle supports the category', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/scheduler/assign',
      payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'radioactive', planned_weight_kg: 100 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NO_VEHICLE_AVAILABLE');
  });

  it('respects exclude_driver_ids', async () => {
    // Exclude all Zone-1 drivers — should still assign from another zone
    const zone1Drivers = [...drivers.values()].filter(d => d.zone_id === 'Zone-1').map(d => d.driver_id);
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/scheduler/assign',
      payload: { job_id: 'JOB-1', zone_id: 'Zone-1', waste_category: 'general', planned_weight_kg: 100, exclude_driver_ids: zone1Drivers },
    });
    expect(res.statusCode).toBe(200);
    expect(zone1Drivers).not.toContain(res.json().driver_id);
  });
});

describe('POST /internal/scheduler/release', () => {
  it('releases the job and returns released:true', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/internal/scheduler/release',
      payload: { job_id: 'JOB-UNKNOWN' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ released: true, job_id: 'JOB-UNKNOWN' });
  });
});
