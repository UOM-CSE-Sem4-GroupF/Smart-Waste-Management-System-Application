import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import collectionsRoutes from '../routes/collections';
import { assignJob, resetStore } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(collectionsRoutes);
  return app;
}

beforeEach(() => resetStore());

describe('POST /api/v1/collections/:job_id/bins/:bin_id/collected', () => {
  it('records a bin as collected', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/JOB-1/bins/B1/collected',
      payload: { actual_weight_kg: 80 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('returns 404 when job does not exist', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/NOPE/bins/B1/collected',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('POST /api/v1/collections/:job_id/bins/:bin_id/skip', () => {
  it('records a bin as skipped with a reason', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/JOB-1/bins/B1/skip',
      payload: { reason: 'road blocked' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('returns 400 when reason is missing', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/JOB-1/bins/B1/skip',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when job does not exist', async () => {
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/NOPE/bins/B1/skip',
      payload: { reason: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/v1/jobs/:job_id/progress', () => {
  it('returns job progress with bin statuses', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/JOB-1/progress' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job_id).toBe('JOB-1');
    expect(body.driver_id).toBe('DRV-001');
    expect(body.current_cargo_kg).toBe(0);
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/NOPE/progress' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});
