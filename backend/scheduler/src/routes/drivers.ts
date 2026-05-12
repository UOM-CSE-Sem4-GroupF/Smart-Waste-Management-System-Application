import { FastifyInstance } from 'fastify';
import { drivers as driversStore, vehicles, getVehicleType } from '../store';
import { AvailableDriversResponse } from '../types';
import * as db from '../db/queries';

function vehicleTypeFromId(vehicle_id: string | null | undefined): string {
  if (!vehicle_id) return '';
  if (vehicle_id.startsWith('LORRY'))  return 'large_truck';
  if (vehicle_id.startsWith('VAN'))    return 'small_van';
  if (vehicle_id.startsWith('TRUCK'))  return 'medium_truck';
  return 'truck';
}

function toDriverResponse(d: { id: string; name: string; zone_id: number; current_vehicle_id: string | null; status: string }) {
  return {
    driver_id:    d.id,
    name:         d.name,
    vehicle_id:   d.current_vehicle_id ?? null,
    vehicle_type: vehicleTypeFromId(d.current_vehicle_id),
    zone_id:      d.zone_id,
    status:       d.status,
  };
}

export default async function driversRoutes(app: FastifyInstance) {
  // GET /api/v1/drivers/available — existing, reads from in-memory store
  app.get('/api/v1/drivers/available', async (): Promise<AvailableDriversResponse> => {
    const availableDrivers: AvailableDriversResponse['drivers'] = [];

    for (const driver of driversStore.values()) {
      if (driver.status === 'available') {
        const vehicle = vehicles.get(driver.vehicle_id);
        if (vehicle) {
          availableDrivers.push({
            driver_id:    driver.driver_id,
            driver_name:  driver.name,
            vehicle_id:   vehicle.vehicle_id,
            vehicle_type: getVehicleType(vehicle.max_cargo_kg),
            zone_id:      driver.zone_id,
            status:       driver.status,
          });
        }
      }
    }

    return { drivers: availableDrivers };
  });

  // GET /api/v1/drivers — list all drivers from F3 DB
  app.get<{
    Querystring: { zone_id?: string; limit?: string; offset?: string };
  }>('/api/v1/drivers', async (req, reply) => {
    const zone_id = req.query.zone_id ? parseInt(req.query.zone_id, 10) : undefined;
    const limit   = req.query.limit   ? parseInt(req.query.limit,   10) : 50;
    const offset  = req.query.offset  ? parseInt(req.query.offset,  10) : 0;

    try {
      const { drivers, total } = await db.getAllDrivers({ zone_id, limit, offset });
      return { data: drivers.map(toDriverResponse), total };
    } catch (e) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch drivers' });
    }
  });

  // GET /api/v1/drivers/:id — single driver
  app.get<{ Params: { id: string } }>('/api/v1/drivers/:id', async (req, reply) => {
    const { id } = req.params;
    if (id === 'available') return reply.callNotFound();

    try {
      const driver = await db.getDriverById(id);
      if (!driver) {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${id} not found` });
      }
      return toDriverResponse(driver);
    } catch (e) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch driver' });
    }
  });

  // POST /api/v1/drivers — create driver
  app.post<{
    Body: { driver_id: string; name: string; zone_id?: number; vehicle_id?: string };
  }>('/api/v1/drivers', async (req, reply) => {
    const { driver_id, name, zone_id, vehicle_id } = req.body;

    if (!driver_id || !name) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'driver_id and name are required' });
    }

    try {
      if (vehicle_id) {
        const vehicle = await db.getVehicleById(vehicle_id);
        if (!vehicle || !vehicle.active) {
          return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${vehicle_id} not found` });
        }
      }

      const driver = await db.createDriver({
        id:                 driver_id,
        name,
        zone_id:            zone_id ?? 0,
        current_vehicle_id: null,
      });
      const assignedDriver = vehicle_id
        ? await db.assignVehicleToDriver(driver.id, vehicle_id)
        : driver;

      return reply.code(201).send(toDriverResponse(assignedDriver ?? driver));
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return reply.code(409).send({ error: 'CONFLICT', message: `Driver ${driver_id} already exists` });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create driver' });
    }
  });

  // PATCH /api/v1/drivers/:id — update driver
  app.patch<{
    Params: { id: string };
    Body:   Record<string, unknown>;
  }>('/api/v1/drivers/:id', async (req, reply) => {
    const { id } = req.params;

    // Build patch from only the known columns. Vehicle assignment is handled below
    // so both f2.vehicles.driver_id and f3.drivers.current_vehicle_id stay aligned.
    const body = req.body as any;
    const patch: Parameters<typeof db.updateDriver>[1] = {};
    if (body.name        !== undefined) patch.name               = String(body.name);
    if (body.zone_id     !== undefined) patch.zone_id            = Number(body.zone_id);
    if (body.status      !== undefined) patch.status             = String(body.status);
    if (body.active      !== undefined && body.active === false) patch.status = 'off_duty';

    try {
      let driver = Object.keys(patch).length > 0
        ? await db.updateDriver(id, patch)
        : await db.getDriverById(id);

      if (!driver) {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${id} not found` });
      }

      if (body.vehicle_id !== undefined) {
        const vehicle_id = body.vehicle_id ? String(body.vehicle_id) : null;
        if (vehicle_id) {
          const vehicle = await db.getVehicleById(vehicle_id);
          if (!vehicle || !vehicle.active) {
            return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${vehicle_id} not found` });
          }
        }

        driver = await db.assignVehicleToDriver(id, vehicle_id);
        if (!driver) {
          return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${id} not found` });
        }
      }

      return toDriverResponse(driver);
    } catch (e) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update driver' });
    }
  });
}
