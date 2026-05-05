import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import vehiclesRoutes from '../routes/vehicles';
import { vehicles, drivers, activeJobs, resetStore } from '../store';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(vehiclesRoutes);
  return app;
}

beforeEach(() => resetStore());

describe('GET /api/v1/vehicles/active', () => {
  it('returns empty when all vehicles are available', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    expect(res.statusCode).toBe(200);
    expect(res.json().vehicles).toHaveLength(0);
  });

  it('returns vehicles currently on a job', async () => {
    activeJobs.set('JOB-1', {
      job_id: 'JOB-1', state: 'IN_PROGRESS',
      assigned_vehicle_id: 'LORRY-01', assigned_driver_id: 'DRV-001',
      zone_id: 1, waste_category: 'general', total_bins: 2, created_at: new Date().toISOString(),
    });
    vehicles.get('LORRY-01')!.status = 'in_progress';
    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles/active' });
    expect(res.json().vehicles).toHaveLength(1);
    expect(res.json().vehicles[0].vehicle_id).toBe('LORRY-01');
  });
});
