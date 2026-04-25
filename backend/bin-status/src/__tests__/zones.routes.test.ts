import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import zonesRoutes from '../routes/zones';
import { upsertBin, clearAll } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(zonesRoutes);
  return app;
}

beforeEach(() => clearAll());

describe('GET /api/v1/zones', () => {
  it('returns empty when no bins exist', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/zones' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('aggregates bins by zone', async () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 40, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z1' });
    upsertBin({ bin_id: 'B', fill_level_pct: 80, urgency_score: 85, urgency_status: 'urgent', zone_id: 'Z1' });
    upsertBin({ bin_id: 'C', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z2' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/zones' });
    const zones = res.json().data as Array<{ zone_id: string; bin_count: number; avg_fill_pct: number; urgent_bins: number }>;
    const z1 = zones.find(z => z.zone_id === 'Z1')!;
    expect(z1.bin_count).toBe(2);
    expect(z1.avg_fill_pct).toBe(60);
    expect(z1.urgent_bins).toBe(1); // urgency_score >= 80
    expect(zones.find(z => z.zone_id === 'Z2')).toBeDefined();
  });
});

describe('GET /api/v1/zones/:id/summary', () => {
  it('returns summary for existing zone', async () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 20, urgency_score: 20, urgency_status: 'normal', zone_id: 'Z1' });
    upsertBin({ bin_id: 'B', fill_level_pct: 100, urgency_score: 95, urgency_status: 'critical', zone_id: 'Z1' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/zones/Z1/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.zone_id).toBe('Z1');
    expect(body.bin_count).toBe(2);
    expect(body.avg_fill_pct).toBe(60);
    expect(body.critical_bins).toBe(1);
    expect(body.bins_by_status.normal).toBe(1);
    expect(body.bins_by_status.critical).toBe(1);
  });

  it('returns 404 for zone with no bins', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/zones/GHOST/summary' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});
