import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import vehiclesRoutes from '../routes/vehicles';
import { vehicles, resetStore, assignJob } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(vehiclesRoutes);
  return app;
}

beforeEach(() => resetStore());

describe('GET /api/v1/vehicles', () => {
  it('returns all 4 seed vehicles', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(4);
  });
});

describe('GET /api/v1/vehicles/active', () => {
  it('returns empty when all vehicles are available', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    expect(res.json().data).toHaveLength(0);
  });

  it('returns only vehicles currently on a job', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 300);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].vehicle_id).toBe('LORRY-01');
  });
});

describe('GET /api/v1/vehicles/:id', () => {
  it('returns vehicle details', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/LORRY-02' });
    expect(res.statusCode).toBe(200);
    expect(res.json().vehicle_id).toBe('LORRY-02');
  });

  it('returns 404 for unknown vehicle', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/GHOST' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('RESOURCE_NOT_FOUND');
  });
});
