import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import readRoutes from '../api/readRoutes';
import { clearAll, assignJob } from '../db/queries';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(readRoutes);
  return app;
}

beforeEach(() => clearAll());

describe('GET /api/v1/drivers', () => {
  it('returns all 5 seed drivers', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(5);
  });
});

describe('GET /api/v1/drivers/available', () => {
  it('returns all 5 when all are free', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
    expect(res.json().drivers).toHaveLength(5);
  });

  it('excludes drivers currently on a job', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 300);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
    expect(res.json().drivers).toHaveLength(4);
    expect(res.json().drivers.map((d: { driver_id: string }) => d.driver_id)).not.toContain('DRV-001');
  });
});

describe('GET /api/v1/drivers/:id', () => {
  it('returns driver details', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/DRV-003' });
    expect(res.statusCode).toBe(200);
    expect(res.json().driver_id).toBe('DRV-003');
    expect(res.json().name).toBe('Kamal Fernando');
  });

  it('returns 404 for unknown driver', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/GHOST' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('GET /api/v1/jobs/:job_id/progress', () => {
  it('returns 404 for unknown job', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/NOPE/progress' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns progress for a real job', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 500);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/jobs/JOB-1/progress' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job_id).toBe('JOB-1');
    expect(body.driver_id).toBe('DRV-001');
    expect(body.cargo_weight_kg).toBe(0);
  });
});
