import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../routes/internal';
import { vehicles, drivers, activeJobs, resetStore } from '../store';

// Prevent dispatch from calling the real notification service
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe('POST /internal/scheduler/dispatch', () => {
  const payload = {
    job_id: 'JOB-1',
    clusters: [{ cluster_id: 'C1', lat: 6.9, lng: 79.8, cluster_name: 'Cluster 1' }],
    bins_to_collect: [{
      bin_id: 'B1', cluster_id: 'C1', lat: 6.9, lng: 79.8,
      waste_category: 'general', fill_level_pct: 80,
      estimated_weight_kg: 50, urgency_score: 85, predicted_full_at: null,
    }],
    total_estimated_weight_kg: 50,
    waste_category: 'general',
    zone_id: 1,
    priority: 8,
  };

  it('returns vehicle_id and driver_id on success', async () => {
    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.vehicle_id).toBeDefined();
    expect(body.driver_id).toBeDefined();
    expect(body.route_plan_id).toBeDefined();
  });

  it('marks vehicle and driver as dispatched', async () => {
    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload });
    const { vehicle_id, driver_id } = res.json();
    expect(vehicles.get(vehicle_id)?.status).toBe('dispatched');
    expect(drivers.get(driver_id)?.status).toBe('dispatched');
  });

  it('returns 409 when no vehicle supports the category', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/dispatch',
      payload: { ...payload, waste_category: 'radioactive' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().reason).toBe('NO_VEHICLE_AVAILABLE');
  });

  it('calls notification service fire-and-forget', async () => {
    await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload });
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe('POST /internal/scheduler/release', () => {
  it('returns released:true even for unknown job_id', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/release', payload: { job_id: 'NOPE' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().released).toBe(true);
  });

  it('frees vehicle and driver when a known job is released', async () => {
    // Set up a dispatched job
    activeJobs.set('JOB-2', {
      job_id: 'JOB-2', state: 'DISPATCHED',
      assigned_vehicle_id: 'LORRY-01', assigned_driver_id: 'DRV-001',
      zone_id: 1, waste_category: 'general', total_bins: 1, created_at: new Date().toISOString(),
    });
    vehicles.get('LORRY-01')!.status = 'dispatched';
    drivers.get('DRV-001')!.status = 'dispatched';

    await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/release', payload: { job_id: 'JOB-2' },
    });

    expect(vehicles.get('LORRY-01')?.status).toBe('available');
    expect(drivers.get('DRV-001')?.status).toBe('available');
    expect(activeJobs.has('JOB-2')).toBe(false);
  });
});
