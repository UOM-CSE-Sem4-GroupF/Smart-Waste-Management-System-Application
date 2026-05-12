import { FastifyInstance } from 'fastify';
import { DispatchRequest, JobAssignedNotification, VehiclePositionUpdate } from '../types';
import { callORTools, nearestNeighbourFallback, activeJobs, routePlans, clusterCoordinates } from '../store';
import * as coreApi from '../clients/coreApiClient';
import * as db from '../db/queries';

const NOTIFICATION_URL = process.env.NOTIFICATION_URL ?? 'http://notification:3004';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

export default async function internalRoutes(app: FastifyInstance) {
  // POST /internal/scheduler/dispatch
  app.post<{ Body: DispatchRequest }>('/internal/scheduler/dispatch', async (req, reply) => {
    const { job_id, clusters, bins_to_collect, total_estimated_weight_kg, waste_category, zone_id, priority } = req.body;
    const parsedZoneId = typeof zone_id === 'string' ? parseInt(zone_id, 10) : zone_id;

    slog('INFO', `Dispatching job ${job_id} for ${bins_to_collect.length} bins, ${total_estimated_weight_kg}kg`);

    // Step 1: Find available vehicle from Core API
    const vehicle = await coreApi.findAvailableVehicle(waste_category, total_estimated_weight_kg);
    if (!vehicle) {
      slog('WARN', `No vehicle available for job ${job_id}`);
      return reply.code(409).send({ success: false, reason: 'NO_VEHICLE_AVAILABLE' });
    }

    // Step 2: Find driver for this vehicle from F3 DB
    const driver = await db.getDriverByVehicle(vehicle.vehicle_id);
    if (!driver) {
      slog('ERROR', `Vehicle ${vehicle.vehicle_id} has no driver assigned in F3`);
      return reply.code(500).send({ success: false, reason: 'VEHICLE_CONFIG_ERROR' });
    }

    // Step 3: Route planning via OR-Tools (with 35s timeout fallback)
    let routeResult;
    try {
      const availableVehicles = [{ vehicle_id: vehicle.vehicle_id, max_cargo_kg: vehicle.max_cargo_kg, waste_categories_supported: [waste_category], lat: 6.9271, lng: 79.8612 }];
      const depot = { lat: 6.9271, lng: 79.8612 };
      routeResult = await Promise.race([
        callORTools(job_id, 'emergency', clusters, bins_to_collect, availableVehicles, depot, {}),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 35_000)),
      ]);
    } catch {
      slog('WARN', `OR-Tools timeout for job ${job_id}, using fallback`);
      const depot = { lat: 6.9271, lng: 79.8612 };
      routeResult = {
        vehicle_id:         vehicle.vehicle_id,
        waypoints:          nearestNeighbourFallback(bins_to_collect, depot),
        total_distance_km:  0,
        estimated_minutes:  0,
      };
    }

    // Step 4: Mark vehicle dispatched via Core API
    await coreApi.setVehicleStatus(vehicle.vehicle_id, 'dispatched');

    // Step 5: Mark driver on_job in F3 DB
    await db.setDriverStatus(driver.id, 'on_job');

    // Step 6: Create route plan in Core API, get back the persisted route_plan_id
    let route_plan_id: string;
    try {
      route_plan_id = await coreApi.createRoutePlan({
        vehicle_id:           vehicle.vehicle_id,
        zone_id:              parsedZoneId,
        route_type:           'emergency',
        waypoints:            routeResult.waypoints,
        total_clusters:       clusters.length,
        total_bins:           bins_to_collect.length,
        estimated_weight_kg:  total_estimated_weight_kg,
        estimated_distance_km: routeResult.total_distance_km,
        estimated_minutes:    routeResult.estimated_minutes,
      });
    } catch (e) {
      slog('WARN', `createRoutePlan failed: ${(e as Error).message} — using local id`);
      route_plan_id = `route_${job_id}`;
    }

    // Step 7: Write bin collection records to F3 DB
    await db.createBinCollectionRecords(job_id, bins_to_collect.map((bin, index) => {
      const waypoint = routeResult.waypoints.find(w => w.bins.includes(bin.bin_id));
      return {
        bin_id:              bin.bin_id,
        cluster_id:          bin.cluster_id,
        sequence:            index + 1,
        planned_arrival_at:  waypoint?.estimated_arrival ?? null,
        estimated_weight_kg: bin.estimated_weight_kg,
      };
    }));

    // Step 8: Record driver assignment in F3 DB
    await db.recordAssignment({ job_id, driver_id: driver.id, vehicle_id: vehicle.vehicle_id, assignment_type: 'accepted' }).catch(() => {});

    // Step 9: Keep activeJobs in-memory for in-flight state (orchestrator is source of truth)
    activeJobs.set(job_id, {
      job_id,
      state:               'DISPATCHED',
      assigned_vehicle_id: vehicle.vehicle_id,
      assigned_driver_id:  driver.id,
      zone_id:             parsedZoneId,
      waste_category,
      total_bins:          bins_to_collect.length,
      created_at:          new Date().toISOString(),
    });

    // Cache route plan for live vehicle enrichment in Kafka consumer
    routePlans.set(route_plan_id, {
      route_plan_id,
      job_id,
      vehicle_id:           vehicle.vehicle_id,
      route_type:           'emergency',
      zone_id:              parsedZoneId,
      waypoints:            routeResult.waypoints,
      total_bins:           bins_to_collect.length,
      estimated_weight_kg:  total_estimated_weight_kg,
      estimated_distance_km: routeResult.total_distance_km,
      estimated_minutes:    routeResult.estimated_minutes,
      created_at:           new Date().toISOString(),
    });

    // Cache cluster coordinates for proximity detection in Kafka consumer
    for (const cluster of clusters) {
      clusterCoordinates.set(cluster.cluster_id, { lat: cluster.lat, lng: cluster.lng });
    }

    // Step 10: Notify driver (fire-and-forget)
    const notification: JobAssignedNotification = {
      driver_id:              driver.id,
      vehicle_id:             vehicle.vehicle_id,
      job_id,
      clusters,
      route:                  routeResult.waypoints,
      estimated_duration_min: routeResult.estimated_minutes,
    };
    fetch(`${NOTIFICATION_URL}/internal/notify/job-assigned`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(notification),
    }).catch(e => slog('WARN', `Notification failed for job ${job_id}: ${(e as Error).message}`));

    slog('INFO', `Job ${job_id} assigned to ${driver.id}/${vehicle.vehicle_id}`);

    return {
      success:           true,
      vehicle_id:        vehicle.vehicle_id,
      driver_id:         driver.id,
      route_plan_id,
      estimated_minutes: routeResult.estimated_minutes,
      route:             routeResult.waypoints,
    };
  });

  // POST /internal/scheduler/release
  app.post<{ Body: { job_id: string } }>('/internal/scheduler/release', async (req) => {
    const { job_id } = req.body;

    // Try DB first (survives restarts), fall back to in-memory
    const assignment = await db.getJobAssignment(job_id).catch(() => null)
      ?? (() => {
        const j = activeJobs.get(job_id);
        return j ? { assigned_vehicle_id: j.assigned_vehicle_id, assigned_driver_id: j.assigned_driver_id } : null;
      })();

    if (assignment) {
      const { assigned_vehicle_id, assigned_driver_id } = assignment;
      if (assigned_vehicle_id) await coreApi.setVehicleStatus(assigned_vehicle_id, 'available').catch(() => {});
      if (assigned_driver_id)  await db.setDriverStatus(assigned_driver_id, 'available').catch(() => {});
      if (assigned_vehicle_id && assigned_driver_id) {
        await db.recordAssignment({ job_id, driver_id: assigned_driver_id, vehicle_id: assigned_vehicle_id, assignment_type: 'released' }).catch(() => {});
      }
      activeJobs.delete(job_id);
      slog('INFO', `Released vehicle/driver for job ${job_id}`);
    }

    return { released: true };
  });

  // POST /internal/notify/vehicle-position
  app.post<{ Body: VehiclePositionUpdate }>('/internal/notify/vehicle-position', async (req) => {
    const update = req.body;
    slog('INFO', `Vehicle position update: ${update.vehicle_id} at ${update.lat},${update.lng}`);
    return { acknowledged: true };
  });

  // POST /internal/notify/alert-deviation
  app.post<{ Body: { vehicle_id: string; driver_id: string; job_id: string; deviation_metres: number; duration_seconds: number; message: string } }>(
    '/internal/notify/alert-deviation', async (req) => {
      const { vehicle_id, message } = req.body;
      slog('WARN', `Deviation alert: ${vehicle_id} ${message}`);
      return { acknowledged: true };
    },
  );

  // POST /internal/jobs/:job_id/vehicle-full
  app.post<{ Params: { job_id: string } }>('/internal/jobs/:job_id/vehicle-full', async (req) => {
    const { job_id } = req.params;
    slog('WARN', `Vehicle full for job ${job_id}`);
    return { acknowledged: true };
  });

  // POST /internal/jobs/:job_id/complete
  app.post<{ Params: { job_id: string } }>('/internal/jobs/:job_id/complete', async (req) => {
    const { job_id } = req.params;
    const job = activeJobs.get(job_id);
    if (job) {
      job.state = 'COMPLETED';
      slog('INFO', `Job ${job_id} marked COMPLETED in memory`);
    }
    return { acknowledged: true };
  });
}
