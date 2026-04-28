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
    expect(res.json().vehicles).toHaveLength(0);
  });

  it('returns only vehicles currently on a job', async () => {
    assignJob('JOB-1', 'DRV-001', 'LORRY-01', 300);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    expect(res.json().vehicles).toHaveLength(1);
    expect(res.json().vehicles[0].vehicle_id).toBe('LORRY-01');
  });

  it('includes driver and cargo context in active vehicle', async () => {
    assignJob('JOB-2', 'DRV-002', 'LORRY-02', 1000);
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    const v = res.json().vehicles[0];
    expect(v.driver_id).toBe('DRV-002');
    expect(v.cargo_limit_kg).toBe(8000);
    expect(v.cargo_weight_kg).toBe(0);
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
