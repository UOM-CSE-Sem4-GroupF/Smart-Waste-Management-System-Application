import { FastifyInstance } from 'fastify';
import { vehicles, drivers, activeJobs, getVehicleType } from '../store';
import { ActiveVehiclesResponse } from '../types';
import * as db from '../db/queries';

const VALID_VEHICLE_TYPES = new Set(['small', 'medium', 'large', 'extra_large']);
const VALID_VEHICLE_STATUSES = new Set(['available', 'dispatched', 'maintenance', 'decommissioned']);

function normaliseVehicleType(value: unknown): string {
  const raw = String(value ?? '').trim();
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  const aliases: Record<string, string> = {
    garbage_truck: 'medium',
    compactor: 'large',
    mini_truck: 'small',
    electric_van: 'small',
    tractor: 'medium',
    truck: 'medium',
    lorry: 'large',
    large_truck: 'large',
    medium_truck: 'medium',
    small_van: 'small',
  };
  return aliases[lower] ?? lower;
}

function vehicleTypeLabel(vehicle_type: string): string {
  return vehicle_type;
}

function toVehicleResponse(v: db.DbVehicle, driver?: db.DbDriver | null) {
  return {
    vehicle_id:   v.id,
    vehicle_type: vehicleTypeLabel(v.vehicle_type),
    capacity_kg:  Number(v.max_cargo_kg),
    max_cargo_kg: Number(v.max_cargo_kg),
    registration: v.registration,
    year:         null,
    status:       v.active ? v.status : 'inactive',
    active:       v.active,
    driver_id:    driver?.id ?? v.driver_id ?? null,
    driver_name:  driver?.name ?? null,
  };
}

export default async function vehiclesRoutes(app: FastifyInstance) {
  // GET /api/v1/vehicles/active
  app.get('/api/v1/vehicles/active', async (): Promise<ActiveVehiclesResponse> => {
    const activeVehicles: ActiveVehiclesResponse['vehicles'] = [];

    for (const job of activeJobs.values()) {
      if (job.state === 'DISPATCHED' || job.state === 'IN_PROGRESS') {
        const vehicle = vehicles.get(job.assigned_vehicle_id);
        const driver = drivers.get(job.assigned_driver_id);

        if (vehicle && driver) {
          // Calculate cargo weight (mock - would sum from bin records)
          const cargoWeightKg = 0; // Would calculate from collected bins
          const cargoUtilisationPct = vehicle.max_cargo_kg > 0 ? (cargoWeightKg / vehicle.max_cargo_kg) * 100 : 0;

          activeVehicles.push({
            vehicle_id: vehicle.vehicle_id,
            vehicle_type: getVehicleType(vehicle.max_cargo_kg),
            driver_id: driver.driver_id,
            driver_name: driver.name,
            job_id: job.job_id,
            job_type: 'emergency', // Would determine from job data
            zone_id: job.zone_id,
            state: vehicle.status,
            current_lat: vehicle.lat,
            current_lng: vehicle.lng,
            last_seen_at: new Date().toISOString(), // Would track from GPS updates
            cargo_weight_kg: cargoWeightKg,
            cargo_limit_kg: vehicle.max_cargo_kg,
            cargo_utilisation_pct: cargoUtilisationPct,
            bins_collected: 0, // Would count from bin records
            bins_total: job.total_bins
          });
        }
      }
    }

    return { vehicles: activeVehicles };
  });

  // GET /api/v1/vehicles — fleet CRUD list, backed by f2.vehicles
  app.get<{
    Querystring: { status?: string; active?: string; limit?: string; offset?: string };
  }>('/api/v1/vehicles', async (req, reply) => {
    const limit  = req.query.limit  ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const active = req.query.active === undefined ? undefined : req.query.active === 'true';

    try {
      const { vehicles: dbVehicles, total } = await db.getAllVehicles({
        status: req.query.status,
        active,
        limit,
        offset,
      });
      const assignedDrivers = await db.getDriversByVehicleIds(dbVehicles.map((v) => v.id));
      const driversByVehicle = new Map(assignedDrivers.map((d) => [d.current_vehicle_id, d]));

      return {
        data: dbVehicles.map((v) => toVehicleResponse(v, driversByVehicle.get(v.id) ?? null)),
        total,
      };
    } catch (e) {
      req.log.error({ err: e }, 'Failed to fetch vehicles');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch vehicles' });
    }
  });

  // GET /api/v1/vehicles/:id — single fleet asset
  app.get<{ Params: { id: string } }>('/api/v1/vehicles/:id', async (req, reply) => {
    const { id } = req.params;
    if (id === 'active') return reply.callNotFound();

    try {
      const vehicle = await db.getVehicleById(id);
      if (!vehicle) {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${id} not found` });
      }
      const driver = await db.getDriverByVehicle(id);
      return toVehicleResponse(vehicle, driver);
    } catch (e) {
      req.log.error({ err: e, vehicle_id: id }, 'Failed to fetch vehicle');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch vehicle' });
    }
  });

  // POST /api/v1/vehicles — create vehicle, with optional driver assignment
  app.post<{
    Body: {
      vehicle_id?: string;
      id?: string;
      vehicle_type?: string;
      capacity_kg?: number;
      max_cargo_kg?: number;
      registration?: string;
      status?: string;
      driver_id?: string | null;
    };
  }>('/api/v1/vehicles', async (req, reply) => {
    const body = req.body;
    const vehicle_id = String(body.vehicle_id ?? body.id ?? '').trim();
    const registration = String(body.registration ?? '').trim();
    const vehicle_type = normaliseVehicleType(body.vehicle_type);
    const max_cargo_kg = Number(body.max_cargo_kg ?? body.capacity_kg);
    const status = body.status ? String(body.status) : 'available';

    if (!vehicle_id || !registration || !vehicle_type || !Number.isFinite(max_cargo_kg) || max_cargo_kg <= 0) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: 'vehicle_id, registration, vehicle_type, and positive capacity_kg are required',
      });
    }
    if (!VALID_VEHICLE_TYPES.has(vehicle_type)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'vehicle_type must be small, medium, large, or extra_large' });
    }
    if (!VALID_VEHICLE_STATUSES.has(status)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid vehicle status' });
    }

    try {
      const driver_id = body.driver_id ? String(body.driver_id) : null;
      if (driver_id) {
        const driver = await db.getDriverById(driver_id);
        if (!driver) {
          return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${driver_id} not found` });
        }
      }

      let vehicle = await db.createVehicle({
        id: vehicle_id,
        registration,
        vehicle_type,
        max_cargo_kg,
        status,
      });

      if (driver_id) {
        vehicle = await db.assignDriverToVehicle(vehicle.id, driver_id) ?? vehicle;
      }

      const driver = await db.getDriverByVehicle(vehicle.id);
      return reply.code(201).send(toVehicleResponse(vehicle, driver));
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return reply.code(409).send({ error: 'CONFLICT', message: `Vehicle ${vehicle_id} or registration ${registration} already exists` });
      }
      if (e?.message === 'DRIVER_NOT_FOUND') {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${body.driver_id} not found` });
      }
      req.log.error({ err: e, vehicle_id }, 'Failed to create vehicle');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create vehicle' });
    }
  });

  // PATCH /api/v1/vehicles/:id — update vehicle and optional assignment
  app.patch<{
    Params: { id: string };
    Body:   Record<string, unknown>;
  }>('/api/v1/vehicles/:id', async (req, reply) => {
    const { id } = req.params;
    const body = req.body as any;
    const patch: Parameters<typeof db.updateVehicle>[1] = {};

    if (body.registration !== undefined) patch.registration = String(body.registration);
    if (body.vehicle_type !== undefined) {
      const vehicle_type = normaliseVehicleType(body.vehicle_type);
      if (!VALID_VEHICLE_TYPES.has(vehicle_type)) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'vehicle_type must be small, medium, large, or extra_large' });
      }
      patch.vehicle_type = vehicle_type;
    }
    if (body.capacity_kg !== undefined || body.max_cargo_kg !== undefined) {
      const max_cargo_kg = Number(body.max_cargo_kg ?? body.capacity_kg);
      if (!Number.isFinite(max_cargo_kg) || max_cargo_kg <= 0) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'capacity_kg must be positive' });
      }
      patch.max_cargo_kg = max_cargo_kg;
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (status === 'inactive') {
        patch.active = false;
        patch.status = 'decommissioned';
      } else {
        if (!VALID_VEHICLE_STATUSES.has(status)) {
          return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid vehicle status' });
        }
        patch.status = status;
        if (status !== 'decommissioned') patch.active = true;
      }
    }
    if (body.active !== undefined) {
      patch.active = Boolean(body.active);
      if (!patch.active) patch.status = 'decommissioned';
      if (patch.active && body.status === undefined) patch.status = 'available';
    }

    try {
      if (body.driver_id !== undefined && body.driver_id) {
        const driver = await db.getDriverById(String(body.driver_id));
        if (!driver) {
          return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${body.driver_id} not found` });
        }
      }

      let vehicle = Object.keys(patch).length > 0
        ? await db.updateVehicle(id, patch)
        : await db.getVehicleById(id);

      if (!vehicle) {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${id} not found` });
      }

      if (body.driver_id !== undefined) {
        const driver_id = body.driver_id ? String(body.driver_id) : null;
        vehicle = await db.assignDriverToVehicle(id, driver_id);
        if (!vehicle) {
          return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${id} not found` });
        }
      }

      const driver = await db.getDriverByVehicle(id);
      return toVehicleResponse(vehicle, driver);
    } catch (e: any) {
      if (e?.message === 'DRIVER_NOT_FOUND') {
        return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${body.driver_id} not found` });
      }
      req.log.error({ err: e, vehicle_id: id }, 'Failed to update vehicle');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update vehicle' });
    }
  });
}
