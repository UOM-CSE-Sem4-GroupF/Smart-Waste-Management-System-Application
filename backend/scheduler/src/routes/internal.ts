import { FastifyInstance } from 'fastify';
import {
  DispatchRequest,
  BinCollectionRecord,
  JobAssignedNotification,
  VehiclePositionUpdate
} from '../types';
import {
  findAvailableVehicle,
  callORTools,
  nearestNeighbourFallback,
  vehicles,
  drivers,
  routePlans,
  binCollectionRecords,
  activeJobs
} from '../store';

const NOTIFICATION_URL = process.env.NOTIFICATION_URL ?? 'http://notification:3004';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

export default async function internalRoutes(app: FastifyInstance) {
  // POST /internal/scheduler/dispatch - Main dispatch endpoint
  app.post<{ Body: DispatchRequest }>('/internal/scheduler/dispatch', async (req, reply) => {
    const {
      job_id,
      clusters,
      bins_to_collect,
      total_estimated_weight_kg,
      waste_category,
      zone_id,
      priority
    } = req.body;

    slog('INFO', `Dispatching job ${job_id} for ${bins_to_collect.length} bins, ${total_estimated_weight_kg}kg`);

    // Step 1: Find available vehicle
    const vehicle = findAvailableVehicle(waste_category, total_estimated_weight_kg);
    if (!vehicle) {
      slog('WARN', `No vehicle available for job ${job_id}`);
      return reply.code(409).send({ success: false, reason: 'NO_VEHICLE_AVAILABLE' });
    }

    const driver = drivers.get(vehicle.driver_id);
    if (!driver) {
      slog('ERROR', `Vehicle ${vehicle.vehicle_id} has no driver`);
      return reply.code(500).send({ success: false, reason: 'VEHICLE_CONFIG_ERROR' });
    }

    // Step 2: Call OR-Tools (with timeout fallback)
    let routeResult;
    try {
      const availableVehicles = [{
        vehicle_id: vehicle.vehicle_id,
        max_cargo_kg: vehicle.max_cargo_kg,
        lat: vehicle.lat,
        lng: vehicle.lng
      }];
      const depot = { lat: vehicle.lat, lng: vehicle.lng }; // Assume depot is vehicle location

      routeResult = await Promise.race([
        callORTools(clusters, bins_to_collect, availableVehicles, depot, {}),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 35000)
        )
      ]);
    } catch (error) {
      slog('WARN', `OR-Tools timeout for job ${job_id}, using fallback`);
      const depot = { lat: vehicle.lat, lng: vehicle.lng };
      routeResult = {
        vehicle_id: vehicle.vehicle_id,
        waypoints: nearestNeighbourFallback(bins_to_collect, depot),
        total_distance_km: 0,
        estimated_minutes: 0
      };
    }

    // Step 3: Assign vehicle
    vehicle.status = 'dispatched';
    driver.status = 'dispatched';

    // Step 4: Store route plan
    const routePlanId = `route_${job_id}`;
    const routePlan = {
      route_plan_id: routePlanId,
      job_id,
      vehicle_id: vehicle.vehicle_id,
      route_type: 'emergency' as const,
      zone_id,
      waypoints: routeResult.waypoints,
      total_bins: bins_to_collect.length,
      estimated_weight_kg: total_estimated_weight_kg,
      estimated_distance_km: routeResult.total_distance_km,
      estimated_minutes: routeResult.estimated_minutes,
      created_at: new Date().toISOString()
    };
    routePlans.set(routePlanId, routePlan);

    // Step 5: Create bin collection records
    bins_to_collect.forEach((bin, index) => {
      const waypoint = routeResult.waypoints.find(w => w.bins.includes(bin.bin_id));
      const record: BinCollectionRecord = {
        job_id,
        bin_id: bin.bin_id,
        sequence_number: index + 1,
        planned_arrival_at: waypoint?.estimated_arrival || null,
        estimated_weight_kg: bin.estimated_weight_kg
      };
      binCollectionRecords.set(`${job_id}_${bin.bin_id}`, record);
    });

    // Step 6: Store active job
    activeJobs.set(job_id, {
      job_id,
      state: 'DISPATCHED',
      assigned_vehicle_id: vehicle.vehicle_id,
      assigned_driver_id: driver.driver_id,
      zone_id,
      waste_category,
      total_bins: bins_to_collect.length,
      created_at: new Date().toISOString()
    });

    // Step 7: Call notification service — push job assignment to driver
    const notification: JobAssignedNotification = {
      driver_id: driver.driver_id,
      vehicle_id: vehicle.vehicle_id,
      job_id,
      clusters,
      route: routeResult.waypoints,
      estimated_duration_min: routeResult.estimated_minutes
    };
    slog('INFO', `Job ${job_id} assigned to ${driver.driver_id}/${vehicle.vehicle_id}`);

    fetch(`${NOTIFICATION_URL}/internal/notify/job-assigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    }).catch(e => slog('WARN', `Notification call failed for job ${job_id}: ${(e as Error).message}`));

    return {
      success: true,
      vehicle_id: vehicle.vehicle_id,
      driver_id: driver.driver_id,
      route_plan_id: routePlanId,
      estimated_minutes: routeResult.estimated_minutes,
      route: routeResult.waypoints
    };
  });

  // POST /internal/notify/vehicle-position - Mock endpoint for notification service
  app.post<{ Body: VehiclePositionUpdate }>('/internal/notify/vehicle-position', async (req) => {
    const update = req.body;
    slog('INFO', `Vehicle position update: ${update.vehicle_id} at ${update.lat},${update.lng}`);
    // In real system, this would forward to dashboard via Socket.IO
    return { acknowledged: true };
  });

  // POST /internal/notify/alert-deviation - Mock endpoint for notification service
  app.post<{ Body: { vehicle_id: string; driver_id: string; job_id: string; deviation_metres: number; duration_seconds: number; message: string } }>(
    '/internal/notify/alert-deviation', async (req) => {
      const { vehicle_id, message } = req.body;
      slog('WARN', `Deviation alert: ${vehicle_id} ${message}`);
      return { acknowledged: true };
    },
  );

  // POST /internal/jobs/:job_id/vehicle-full - Called when vehicle reaches weight limit
  app.post<{ Params: { job_id: string } }>('/internal/jobs/:job_id/vehicle-full', async (req) => {
    const { job_id } = req.params;
    slog('WARN', `Vehicle full for job ${job_id}`);
    // In real system, orchestrator would create new job for remaining bins
    return { acknowledged: true };
  });

  // POST /internal/jobs/:job_id/complete - Called when job is complete
  app.post<{ Params: { job_id: string } }>('/internal/jobs/:job_id/complete', async (req) => {
    const { job_id } = req.params;
    const job = activeJobs.get(job_id);
    if (job) {
      job.state = 'COMPLETED';
      const vehicle = vehicles.get(job.assigned_vehicle_id);
      const driver = drivers.get(job.assigned_driver_id);
      if (vehicle) vehicle.status = 'available';
      if (driver) driver.status = 'available';
      slog('INFO', `Job ${job_id} completed`);
    }
    return { acknowledged: true };
  });

  // POST /internal/scheduler/release - Called by orchestrator on job cancel/complete
  app.post<{ Body: { job_id: string } }>('/internal/scheduler/release', async (req) => {
    const { job_id } = req.body;
    const job = activeJobs.get(job_id);
    if (job) {
      const vehicle = vehicles.get(job.assigned_vehicle_id);
      const driver  = drivers.get(job.assigned_driver_id);
      if (vehicle) vehicle.status = 'available';
      if (driver)  driver.status  = 'available';
      activeJobs.delete(job_id);
      slog('INFO', `Released vehicle/driver for job ${job_id}`);
    }
    return { released: true };
  });
}
