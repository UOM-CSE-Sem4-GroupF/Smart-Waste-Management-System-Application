import { FastifyInstance } from 'fastify';
import { emitToRoom } from '../socket';
import { JobAssignedBody, JobCancelledBody, RouteUpdatedBody, JobEscalatedBody } from '../types';

export default async function internalRoutes(app: FastifyInstance) {
  // Called by orchestrator: notify driver of job assignment
  app.post<{ Body: JobAssignedBody }>('/internal/notify/job-assigned', async (req) => {
    const { job_id, driver_id, vehicle_id, zone_id, waste_category, estimated_bins, route_id } = req.body;
    const ts = new Date().toISOString();

    emitToRoom(`driver-${driver_id}`, 'job:status', {
      event: 'job_assigned', job_id, vehicle_id, zone_id, waste_category, estimated_bins, route_id, ts,
    });
    emitToRoom('dashboard-all', 'job:status', {
      event: 'job_assigned', job_id, driver_id, vehicle_id, zone_id, ts,
    });

    return { delivered: true, ts };
  });

  // Called by orchestrator: notify driver job was cancelled
  app.post<{ Body: JobCancelledBody }>('/internal/notify/job-cancelled', async (req) => {
    const { job_id, reason, driver_id } = req.body;
    const ts = new Date().toISOString();

    if (driver_id) emitToRoom(`driver-${driver_id}`, 'job:status', { event: 'job_cancelled', job_id, reason, ts });
    emitToRoom('dashboard-all', 'job:status', { event: 'job_cancelled', job_id, driver_id, reason, ts });

    return { delivered: true, ts };
  });

  // Called by orchestrator: notify driver route was updated (e.g. after reassignment)
  app.post<{ Body: RouteUpdatedBody }>('/internal/notify/route-updated', async (req) => {
    const { job_id, driver_id, route_id } = req.body;
    const ts = new Date().toISOString();

    emitToRoom(`driver-${driver_id}`, 'job:status', { event: 'route_updated', job_id, route_id, ts });
    emitToRoom('dashboard-all', 'job:status', { event: 'route_updated', job_id, driver_id, route_id, ts });

    return { delivered: true, ts };
  });

  // Called by orchestrator: alert supervisors that a job needs manual intervention
  app.post<{ Body: JobEscalatedBody }>('/internal/notify/job-escalated', async (req) => {
    const { job_id, zone_id, reason } = req.body;
    const ts = new Date().toISOString();

    emitToRoom('dashboard-all', 'alert:urgent', { event: 'job_escalated', job_id, zone_id, reason, ts });

    return { delivered: true, ts };
  });
}
