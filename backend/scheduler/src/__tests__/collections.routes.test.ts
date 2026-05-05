import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import collectionsRoutes from '../routes/collections';
import { activeJobs, binCollectionRecords, resetStore } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(collectionsRoutes);
  return app;
}

function seedJob(job_id: string) {
  activeJobs.set(job_id, {
    job_id, state: 'IN_PROGRESS',
    assigned_vehicle_id: 'LORRY-01', assigned_driver_id: 'DRV-001',
    zone_id: 1, waste_category: 'general', total_bins: 1, created_at: new Date().toISOString(),
  });
  binCollectionRecords.set(`${job_id}_B1`, {
    job_id, bin_id: 'B1', sequence_number: 1,
    planned_arrival_at: null, estimated_weight_kg: 80,
  });
}

beforeEach(() => resetStore());

describe('POST /api/v1/collections/:job_id/bins/:bin_id/collected', () => {
  it('records a bin as collected', async () => {
    seedJob('JOB-1');
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/JOB-1/bins/B1/collected',
      payload: { fill_level_at_collection: 80, gps_lat: 6.9, gps_lng: 79.8, actual_weight_kg: 80 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('returns 404 when job does not exist', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/NOPE/bins/B1/collected', payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 409 when bin already collected', async () => {
    seedJob('JOB-1');
    binCollectionRecords.get('JOB-1_B1')!.collected_at = new Date().toISOString();
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/collected', payload: {},
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/v1/collections/:job_id/bins/:bin_id/skip', () => {
  it('records a bin as skipped with a reason', async () => {
    seedJob('JOB-1');
    const res = await buildApp().inject({
      method: 'POST',
      url: '/api/v1/collections/JOB-1/bins/B1/skip',
      payload: { reason: 'locked' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('returns 400 when reason is missing', async () => {
    seedJob('JOB-1');
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/skip', payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when job does not exist', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/NOPE/bins/B1/skip', payload: { reason: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/v1/jobs/:job_id/progress', () => {
  it('returns job progress', async () => {
    seedJob('JOB-1');
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/JOB-1/progress' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job_id).toBe('JOB-1');
    expect(body.driver_id).toBe('DRV-001');
    expect(body.bins_pending).toBe(1);
  });

  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/NOPE/progress' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});
