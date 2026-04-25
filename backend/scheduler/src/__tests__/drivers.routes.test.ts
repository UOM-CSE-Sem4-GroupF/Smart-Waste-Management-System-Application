import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import driversRoutes from '../routes/drivers';
import { drivers, resetStore, assignJob } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(driversRoutes);
  return app;
}

beforeEach(() => resetStore());

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
    expect(res.json().data).toHaveLength(5);
  });

  it('excludes drivers currently on a job', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 300);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
    expect(res.json().data).toHaveLength(4);
    expect(res.json().data.map((d: { driver_id: string }) => d.driver_id)).not.toContain('DRV-001');
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
