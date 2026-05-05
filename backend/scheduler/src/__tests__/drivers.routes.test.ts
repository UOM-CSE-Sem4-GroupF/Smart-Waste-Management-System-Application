import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import driversRoutes from '../routes/drivers';
import { drivers, resetStore } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(driversRoutes);
  return app;
}

beforeEach(() => resetStore());

describe('GET /api/v1/drivers/available', () => {
  it('returns all 5 when all are free', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
    expect(res.statusCode).toBe(200);
    expect(res.json().drivers).toHaveLength(5);
  });

  it('excludes dispatched drivers', async () => {
    drivers.get('DRV-001')!.status = 'dispatched';
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/drivers/available' });
    expect(res.json().drivers).toHaveLength(4);
    expect(res.json().drivers.map((d: { driver_id: string }) => d.driver_id)).not.toContain('DRV-001');
  });
});
