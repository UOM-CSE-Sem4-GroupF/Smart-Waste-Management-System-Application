import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import vehiclesRoutes from '../routes/vehicles';
import { vehicles, drivers, activeJobs, resetStore } from '../store';
import * as db from '../db/queries';

vi.mock('../db/queries', () => ({
  getAllVehicles:        vi.fn(),
  getVehicleById:        vi.fn(),
  getDriverByVehicle:    vi.fn(),
  getDriverById:         vi.fn(),
  getDriversByVehicleIds: vi.fn(),
  createVehicle:         vi.fn(),
  updateVehicle:         vi.fn(),
  assignDriverToVehicle: vi.fn(),
}));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(vehiclesRoutes);
  return app;
}

const mockVehicle = {
  id:              'LORRY-99',
  registration:    'WP-LL-9999',
  vehicle_type:    'large',
  max_cargo_kg:    15000,
  volume_m3:       null,
  driver_id:       null,
  status:          'available',
  active:          true,
  last_service_at: null,
  notes:           null,
} as any;

const mockDriver = {
  id:                 'DRV-099',
  name:               'Test Driver',
  zone_id:            1,
  current_vehicle_id: 'LORRY-99',
  status:             'available',
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

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

describe('Vehicle CRUD routes', () => {
  it('lists DB-backed vehicles with assigned driver details', async () => {
    vi.mocked(db.getAllVehicles).mockResolvedValue({ vehicles: [mockVehicle], total: 1 });
    vi.mocked(db.getDriversByVehicleIds).mockResolvedValue([mockDriver]);

    const res = await buildApp().inject({ method: 'GET', url: '/api/v1/vehicles' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      total: 1,
      data: [{
        vehicle_id: 'LORRY-99',
        capacity_kg: 15000,
        driver_id: 'DRV-099',
        driver_name: 'Test Driver',
      }],
    });
  });

  it('creates a vehicle without a driver assignment', async () => {
    vi.mocked(db.createVehicle).mockResolvedValue(mockVehicle);
    vi.mocked(db.getDriverByVehicle).mockResolvedValue(null);

    const res = await buildApp().inject({
      method: 'POST',
      url:    '/api/v1/vehicles',
      payload: {
        vehicle_id:   'LORRY-99',
        vehicle_type: 'large',
        capacity_kg:  15000,
        registration: 'WP-LL-9999',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(db.createVehicle).toHaveBeenCalledWith(expect.objectContaining({
      id:           'LORRY-99',
      vehicle_type: 'large',
      max_cargo_kg: 15000,
    }));
    expect(db.assignDriverToVehicle).not.toHaveBeenCalled();
  });

  it('creates a vehicle and assigns the selected driver', async () => {
    vi.mocked(db.getDriverById).mockResolvedValue(mockDriver);
    vi.mocked(db.createVehicle).mockResolvedValue(mockVehicle);
    vi.mocked(db.assignDriverToVehicle).mockResolvedValue({ ...mockVehicle, driver_id: 'DRV-099' });
    vi.mocked(db.getDriverByVehicle).mockResolvedValue(mockDriver);

    const res = await buildApp().inject({
      method: 'POST',
      url:    '/api/v1/vehicles',
      payload: {
        vehicle_id:   'LORRY-99',
        vehicle_type: 'large',
        capacity_kg:  15000,
        registration: 'WP-LL-9999',
        driver_id:    'DRV-099',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(db.assignDriverToVehicle).toHaveBeenCalledWith('LORRY-99', 'DRV-099');
    expect(res.json().driver_id).toBe('DRV-099');
  });

  it('deactivates a vehicle through PATCH active=false', async () => {
    vi.mocked(db.updateVehicle).mockResolvedValue({ ...mockVehicle, active: false, status: 'decommissioned' });
    vi.mocked(db.getDriverByVehicle).mockResolvedValue(null);

    const res = await buildApp().inject({
      method: 'PATCH',
      url:    '/api/v1/vehicles/LORRY-99',
      payload: { active: false },
    });

    expect(res.statusCode).toBe(200);
    expect(db.updateVehicle).toHaveBeenCalledWith('LORRY-99', {
      active: false,
      status: 'decommissioned',
    });
    expect(res.json().status).toBe('inactive');
  });
});
