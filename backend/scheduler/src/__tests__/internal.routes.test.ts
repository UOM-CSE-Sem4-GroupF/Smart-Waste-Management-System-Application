import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import internalRoutes from '../api/internalRoutes';
import * as db from '../db/queries';

vi.mock('../clients/routeOptimizerClient', () => ({
  solve: vi.fn(),
}));
vi.mock('../clients/notificationClient', () => ({
  notifyJobAssigned: vi.fn().mockResolvedValue(undefined),
}));

const DISPATCH_BODY = {
  job_id:    'JOB-1',
  clusters:  [{ cluster_id: 'C1', lat: 6.9, lng: 79.8, cluster_name: 'Cluster A' }],
  bins_to_collect: [{
    bin_id: 'B1', cluster_id: 'C1', lat: 6.9, lng: 79.8,
    waste_category: 'general', fill_level_pct: 90,
    estimated_weight_kg: 100, urgency_score: 85, predicted_full_at: null,
  }],
  total_estimated_weight_kg: 100,
  waste_category: 'general',
  zone_id:   1,
  priority:  7,
};

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(internalRoutes);
  return app;
}

beforeEach(() => {
  db.clearAll();
  vi.clearAllMocks();
});

describe('POST /internal/scheduler/dispatch', () => {
  it('dispatches with OR-Tools response and returns vehicle + route', async () => {
    const { solve } = await import('../clients/routeOptimizerClient');
    vi.mocked(solve).mockResolvedValueOnce({
      vehicle_id: 'LORRY-03',
      waypoints:  [{ cluster_id: 'C1', bins: ['B1'], estimated_arrival: null, cumulative_weight_kg: 100 }],
      total_distance_km: 5,
      estimated_minutes: 30,
    });

    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload: DISPATCH_BODY });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.vehicle_id).toBeDefined();
    expect(body.driver_id).toBeDefined();
    expect(body.route_plan_id).toMatch(/^RP-/);
    expect(body.route).toHaveLength(1);
  });

  it('falls back to nearest-neighbour when OR-Tools throws', async () => {
    const { solve } = await import('../clients/routeOptimizerClient');
    vi.mocked(solve).mockRejectedValueOnce(new Error('timeout'));

    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload: DISPATCH_BODY });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.route).toHaveLength(1);
  });

  it('returns 409 when no vehicle supports the waste category', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/dispatch',
      payload: { ...DISPATCH_BODY, waste_category: 'radioactive', total_estimated_weight_kg: 100 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NO_VEHICLE_AVAILABLE');
  });

  it('returns 409 when all drivers are unavailable', async () => {
    db.drivers.forEach(d => { d.available = false; });
    const { solve } = await import('../clients/routeOptimizerClient');
    vi.mocked(solve).mockResolvedValueOnce({
      vehicle_id: 'LORRY-03', waypoints: [], total_distance_km: 0, estimated_minutes: 0,
    });

    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload: DISPATCH_BODY });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NO_DRIVER_AVAILABLE');
  });

  it('selects smallest sufficient vehicle (LORRY-03 for 100 kg general)', async () => {
    const { solve } = await import('../clients/routeOptimizerClient');
    vi.mocked(solve).mockRejectedValueOnce(new Error('timeout'));  // force nearest-neighbour

    const res = await buildApp().inject({ method: 'POST', url: '/internal/scheduler/dispatch', payload: DISPATCH_BODY });
    expect(res.statusCode).toBe(200);
    // LORRY-03 supports 'general' and has max_cargo_kg=4000, smallest sufficient
    expect(res.json().vehicle_id).toBe('LORRY-03');
  });
});

describe('POST /internal/scheduler/release', () => {
  it('releases job and returns released:true', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/release', payload: { job_id: 'JOB-UNKNOWN' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ released: true, job_id: 'JOB-UNKNOWN' });
  });

  it('releases a real job and frees driver+vehicle', async () => {
    db.assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    expect(db.drivers.get('DRV-001')!.available).toBe(false);

    const res = await buildApp().inject({
      method: 'POST', url: '/internal/scheduler/release', payload: { job_id: 'JOB-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(db.drivers.get('DRV-001')!.available).toBe(true);
    expect(db.vehicles.get('LORRY-01')!.available).toBe(true);
  });
});
