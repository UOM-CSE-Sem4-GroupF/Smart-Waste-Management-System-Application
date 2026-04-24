import { FastifyInstance } from 'fastify';
import { AssignRequest } from '../types';
import { findAvailableDriver, findAvailableVehicle, assignJob, releaseJob } from '../store';

export default async function internalRoutes(app: FastifyInstance) {
  // Called by orchestrator: assign best available driver + vehicle to a job
  app.post<{ Body: AssignRequest }>('/internal/scheduler/assign', async (req, reply) => {
    const { job_id, zone_id, waste_category, planned_weight_kg, exclude_driver_ids = [] } = req.body;

    const driver = findAvailableDriver(zone_id, exclude_driver_ids);
    if (!driver)
      return reply.code(409).send({ error: 'NO_DRIVER_AVAILABLE', message: 'No available driver found for this zone' });

    const vehicle = findAvailableVehicle(waste_category, planned_weight_kg);
    if (!vehicle)
      return reply.code(409).send({ error: 'NO_VEHICLE_AVAILABLE', message: `No vehicle available for category ${waste_category} with capacity >= ${planned_weight_kg} kg` });

    const progress = assignJob(job_id, driver.driver_id, vehicle.vehicle_id, planned_weight_kg);

    return {
      driver_id:   driver.driver_id,
      vehicle_id:  vehicle.vehicle_id,
      assigned_at: progress.assigned_at,
    };
  });

  // Called by orchestrator: release driver + vehicle when job ends (complete/cancelled/escalated)
  app.post<{ Body: { job_id: string } }>('/internal/scheduler/release', async (req) => {
    releaseJob(req.body.job_id);
    return { released: true, job_id: req.body.job_id };
  });
}
