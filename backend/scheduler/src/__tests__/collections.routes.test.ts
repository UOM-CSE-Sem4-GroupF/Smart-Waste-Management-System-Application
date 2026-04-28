import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import collectionRoutes from '../api/collectionRoutes';
import { assignJob, clearAll, createBinCollectionRecords } from '../db/queries';

vi.mock('../clients/orchestratorClient', () => ({
  notifyJobComplete: vi.fn().mockResolvedValue(undefined),
  notifyVehicleFull: vi.fn().mockResolvedValue(undefined),
}));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(collectionRoutes);
  return app;
}

function setupJob(job_id = 'JOB-1', bins = ['B1', 'B2']) {
  assignJob(job_id, 'DRV-001', 'LORRY-01', 500);
  createBinCollectionRecords(job_id, bins.map((bin_id, i) => ({
    bin_id,
    cluster_id:          'C1',
    lat:                 6.9,
    lng:                 79.8,
    sequence_number:     i + 1,
    estimated_weight_kg: 100,
    planned_arrival_at:  null,
  })));
}

beforeEach(() => { clearAll(); vi.clearAllMocks(); });

describe('POST /api/v1/collections/:job_id/bins/:bin_id/collected', () => {
  it('records a bin as collected and returns job_progress', async () => {
    setupJob();
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/collected',
      payload: { actual_weight_kg: 80 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.bin_id).toBe('B1');
    expect(body.job_progress.bins_collected).toBe(1);
    expect(body.job_progress.bins_pending).toBe(1);
    expect(body.job_progress.cargo_weight_kg).toBe(80);
    expect(body.job_progress.job_complete).toBe(false);
  });

  it('returns 404 when job does not exist', async () => {
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/NOPE/bins/B1/collected', payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 404 when bin is not in this job', async () => {
    setupJob('JOB-1', ['B1']);
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/UNKNOWN/collected', payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 409 when bin already collected', async () => {
    setupJob('JOB-1', ['B1']);
    const app = buildApp();
    await app.inject({ method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/collected', payload: {} });
    const res = await app.inject({ method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/collected', payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('ALREADY_COLLECTED');
  });

  it('marks job_complete true when last bin is resolved', async () => {
    setupJob('JOB-1', ['B1']);
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/collected', payload: {},
    });
    expect(res.json().job_progress.job_complete).toBe(true);
  });
});

describe('POST /api/v1/collections/:job_id/bins/:bin_id/skip', () => {
  it('records a bin as skipped and returns job_progress', async () => {
    setupJob();
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/B1/skip',
      payload: { reason: 'locked' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.job_progress.bins_skipped).toBe(1);
  });

  it('returns 400 when reason is missing', async () => {
    setupJob();
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

  it('returns 404 when bin is not in this job', async () => {
    setupJob('JOB-1', ['B1']);
    const res = await buildApp().inject({
      method: 'POST', url: '/api/v1/collections/JOB-1/bins/UNKNOWN/skip', payload: { reason: 'locked' },
    });
    expect(res.statusCode).toBe(404);
  });
});
