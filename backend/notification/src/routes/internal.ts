import { FastifyInstance } from 'fastify';
import { emitToRoom, emitToRooms, isDriverConnected } from '../socket';
import { sendPush } from '../fcm';
import {
  JobAssignedBody,
  JobCreatedBody,
  JobCompletedBody,
  JobEscalatedBody,
  JobCancelledBody,
  VehiclePositionBody,
  AlertDeviationBody,
} from '../types';

export default async function internalRoutes(app: FastifyInstance) {
  app.post<{ Body: JobAssignedBody }>('/internal/notify/job-assigned', async (req) => {
    const body = req.body;
    const { driver_id, job_id, job_type, total_bins } = body;

    emitToRoom(`driver-${driver_id}`, 'job:assigned', body);

    const connected = await isDriverConnected(driver_id);
    if (!connected) {
      await sendPush(
        driver_id,
        { title: 'New collection job assigned', body: `You have a new ${job_type} collection — ${total_bins} bins` },
        { job_id, job_type, screen: 'job-detail' },
      );
    }

    return { delivered: true };
  });

  app.post<{ Body: JobCreatedBody }>('/internal/notify/job-created', async (req) => {
    const body = req.body;
    emitToRooms([`dashboard-zone-${body.zone_id}`, 'dashboard-all', 'fleet-ops'], 'job:created', body);
    return { delivered: true };
  });

  app.post<{ Body: JobCompletedBody }>('/internal/notify/job-completed', async (req) => {
    const body = req.body;
    const { zone_id, driver_id, job_id } = body;

    emitToRooms([`dashboard-zone-${zone_id}`, 'dashboard-all', 'fleet-ops'], 'job:completed', body);
    emitToRoom(`driver-${driver_id}`, 'job:completed', { job_id, message: 'Job complete. Well done!' });

    const connected = await isDriverConnected(driver_id);
    if (!connected) {
      await sendPush(driver_id, { title: 'Job completed', body: 'Job complete. Well done!' }, { job_id });
    }

    return { delivered: true };
  });

  app.post<{ Body: JobEscalatedBody }>('/internal/notify/job-escalated', async (req) => {
    const { job_id, zone_id, reason, urgent_bins } = req.body;

    emitToRooms([`dashboard-zone-${zone_id}`, 'dashboard-all', 'alerts-all'], 'alert:escalated', {
      job_id,
      zone_id,
      reason,
      message: 'Emergency collection needs manual dispatch — no vehicle available',
      urgent_bins,
    });

    return { delivered: true };
  });

  app.post<{ Body: JobCancelledBody }>('/internal/notify/job-cancelled', async (req) => {
    const body = req.body;
    const { zone_id, driver_id, reason, job_id } = body;

    emitToRooms([`dashboard-zone-${zone_id}`, 'dashboard-all'], 'job:cancelled', body);

    if (driver_id) {
      emitToRoom(`driver-${driver_id}`, 'job:cancelled', body);
      const connected = await isDriverConnected(driver_id);
      if (!connected) {
        await sendPush(driver_id, { title: 'Job cancelled', body: reason }, { job_id });
      }
    }

    return { delivered: true };
  });

  app.post<{ Body: VehiclePositionBody }>('/internal/notify/vehicle-position', async (req) => {
    const body = req.body;
    const { zone_id, vehicle_id, driver_id, cargo_utilisation_pct, weight_limit_warning } = body;

    emitToRooms([`dashboard-zone-${zone_id}`, 'dashboard-all', 'fleet-ops'], 'vehicle:position', body);

    if (weight_limit_warning) {
      emitToRooms(['fleet-ops', 'dashboard-all'], 'alert:weight-limit', {
        vehicle_id,
        driver_id,
        cargo_utilisation_pct,
        message: `Vehicle ${vehicle_id} is at ${cargo_utilisation_pct.toFixed(0)}% cargo capacity`,
      });
    }

    return { delivered: true };
  });

  app.post<{ Body: AlertDeviationBody }>('/internal/notify/alert-deviation', async (req) => {
    const body = req.body;
    emitToRooms(['fleet-ops', `dashboard-zone-${body.zone_id}`, 'alerts-all'], 'alert:deviation', body);
    return { delivered: true };
  });
}
