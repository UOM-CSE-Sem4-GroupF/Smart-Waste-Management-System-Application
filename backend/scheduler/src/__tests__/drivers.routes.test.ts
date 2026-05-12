import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import driversRoutes from '../routes/drivers';
import { drivers, resetStore } from '../store';
import * as db from '../db/queries';

vi.mock('../db/queries', () => ({
  getAllDrivers:          vi.fn(),
  getDriverById:          vi.fn(),
  getVehicleById:         vi.fn(),
  createDriver:           vi.fn(),
  updateDriver:           vi.fn(),
  assignVehicleToDriver:  vi.fn(),
}));

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(driversRoutes);
  return app;
}

const mockDriver = {
  id:                 'DRV-099',
  name:               'Test Driver',
  zone_id:            1,
  current_vehicle_id: null,
  status:             'off_duty',
};

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

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

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

describe('Driver CRUD routes', () => {
  it('creates a driver without a vehicle assignment', async () => {
    vi.mocked(db.createDriver).mockResolvedValue(mockDriver);

    const res = await buildApp().inject({
      method: 'POST',
      url:    '/api/v1/drivers',
      payload: { driver_id: 'DRV-099', name: 'Test Driver', zone_id: 1 },
    });

    expect(res.statusCode).toBe(201);
    expect(db.createDriver).toHaveBeenCalledWith({
      id:                 'DRV-099',
      name:               'Test Driver',
      zone_id:            1,
      current_vehicle_id: null,
    });
    expect(db.assignVehicleToDriver).not.toHaveBeenCalled();
  });

  it('creates a driver and assigns the selected vehicle', async () => {
    vi.mocked(db.getVehicleById).mockResolvedValue(mockVehicle);
    vi.mocked(db.createDriver).mockResolvedValue(mockDriver);
    vi.mocked(db.assignVehicleToDriver).mockResolvedValue({
      ...mockDriver,
      current_vehicle_id: 'LORRY-99',
    });

    const res = await buildApp().inject({
      method: 'POST',
      url:    '/api/v1/drivers',
      payload: {
        driver_id:  'DRV-099',
        name:       'Test Driver',
        zone_id:    1,
        vehicle_id: 'LORRY-99',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(db.assignVehicleToDriver).toHaveBeenCalledWith('DRV-099', 'LORRY-99');
    expect(res.json().vehicle_id).toBe('LORRY-99');
  });

  it('unassigns a vehicle through PATCH vehicle_id=null', async () => {
    vi.mocked(db.getDriverById).mockResolvedValue({ ...mockDriver, current_vehicle_id: 'LORRY-99' });
    vi.mocked(db.assignVehicleToDriver).mockResolvedValue(mockDriver);

    const res = await buildApp().inject({
      method: 'PATCH',
      url:    '/api/v1/drivers/DRV-099',
      payload: { vehicle_id: null },
    });

    expect(res.statusCode).toBe(200);
    expect(db.assignVehicleToDriver).toHaveBeenCalledWith('DRV-099', null);
    expect(res.json().vehicle_id).toBeNull();
  });

  it('maps active=false to off_duty instead of ignoring it', async () => {
    vi.mocked(db.updateDriver).mockResolvedValue(mockDriver);

    const res = await buildApp().inject({
      method: 'PATCH',
      url:    '/api/v1/drivers/DRV-099',
      payload: { active: false },
    });

    expect(res.statusCode).toBe(200);
    expect(db.updateDriver).toHaveBeenCalledWith('DRV-099', { status: 'off_duty' });
  });
});
