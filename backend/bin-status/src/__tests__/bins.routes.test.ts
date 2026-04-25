import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import binsRoutes from '../routes/bins';
import { upsertBin, clearAll } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(binsRoutes);
  return app;
}

beforeEach(() => clearAll());

describe('GET /api/v1/bins', () => {
  it('returns empty list when store is empty', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: [], total: 0, page: 1, limit: 50 });
  });

  it('returns all bins with total count', async () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 10, urgency_score: 10, urgency_status: 'normal' });
    upsertBin({ bin_id: 'B', fill_level_pct: 90, urgency_score: 90, urgency_status: 'critical' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins' });
    expect(res.json().total).toBe(2);
    expect(res.json().data).toHaveLength(2);
  });

  it('filters by zone_id', async () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z1' });
    upsertBin({ bin_id: 'B', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z2' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins?zone_id=Z1' });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].bin_id).toBe('A');
  });

  it('filters by urgency_status', async () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 95, urgency_score: 95, urgency_status: 'critical' });
    upsertBin({ bin_id: 'B', fill_level_pct: 10, urgency_score: 10, urgency_status: 'normal' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins?status=critical' });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].bin_id).toBe('A');
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      upsertBin({ bin_id: `B${i}`, fill_level_pct: i * 10, urgency_score: 0, urgency_status: 'normal' });
    }
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins?page=2&limit=2' });
    expect(res.json().data).toHaveLength(2);
    expect(res.json().total).toBe(5);
    expect(res.json().page).toBe(2);
  });

  it('clamps limit to max 200', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins?limit=999' });
    expect(res.json().limit).toBe(200);
  });
});

describe('GET /api/v1/bins/:id', () => {
  it('returns the bin when found', async () => {
    upsertBin({ bin_id: 'BIN-001', fill_level_pct: 55, urgency_score: 55, urgency_status: 'monitor' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins/BIN-001' });
    expect(res.statusCode).toBe(200);
    expect(res.json().bin_id).toBe('BIN-001');
    expect(res.json().fill_level_pct).toBe(55);
  });

  it('returns 404 for unknown bin', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins/NOPE' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('GET /api/v1/bins/:id/history', () => {
  it('returns empty history for a brand-new bin', async () => {
    upsertBin({ bin_id: 'BIN-001', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins/BIN-001/history' });
    expect(res.statusCode).toBe(200);
    expect(res.json().bin_id).toBe('BIN-001');
    expect(res.json().history).toHaveLength(0);
  });

  it('returns previous states after updates', async () => {
    upsertBin({ bin_id: 'BIN-001', fill_level_pct: 20, urgency_score: 0, urgency_status: 'normal' });
    upsertBin({ bin_id: 'BIN-001', fill_level_pct: 80, urgency_score: 80, urgency_status: 'urgent' });
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins/BIN-001/history' });
    expect(res.json().history).toHaveLength(1);
    expect(res.json().history[0].fill_level_pct).toBe(20);
  });

  it('returns 404 when bin does not exist', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/bins/GHOST/history' });
    expect(res.statusCode).toBe(404);
  });
});
