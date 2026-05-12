import { FastifyInstance } from 'fastify';
import { emitToRoom } from '../socket';
import { findConnectedSocket } from '../socket';

const slog = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'notification:routes', message: msg, ...extra,
  }) + '\n');
};
import { sendPush } from '../fcm';
import { handle } from '../kafka/consumer';
import {
  JobAssignedBody,
  JobCreatedBody,
  JobCompletedBody,
  JobCancelledBody,
  JobEscalatedBody,
  VehiclePositionBody,
  AlertDeviationBody,
} from '../types';

export default async function internalRoutes(app: FastifyInstance) {
  // POST /internal/notify/bin-update
  // Called by bin-status service instead of Kafka (avoids KRaft topic-leader issues)
  app.post('/internal/notify/bin-update', async (req) => {
    const event = req.body as any;
    const timestamp = String(event.timestamp ?? new Date().toISOString());
    slog('DEBUG', `/notify/bin-update received`, {
      event_type: event.event_type,
      bin_id:     event.payload?.bin_id ?? event.bin_id,
      zone_id:    event.payload?.zone_id ?? event.zone_id,
    });
    handle('waste.bin.dashboard.updates', event, timestamp);
    return { delivered: true, ts: timestamp };
  });


  // POST /internal/notify/job-initiated
  // Called by orchestrator immediately after emergency job creation
  app.post('/internal/notify/job-initiated', async (req) => {
    const { job_id, job_type, zone_id, cluster_id, urgency_score, waste_category, message } = req.body as any;
    const ts = new Date().toISOString();
    slog('INFO', `/notify/job-initiated: job ${job_id}`, { job_id, job_type, zone_id, cluster_id, urgency_score, waste_category });

    const payload = {
      job_id,
      job_type,
      zone_id,
      cluster_id,
      urgency_score,
      waste_category,
      message: message ?? `Emergency collection job initiated for cluster ${cluster_id}`,
      timestamp: ts,
    };

    emitToRoom(`dashboard-zone-${zone_id}`, 'job:initiated', payload);
    emitToRoom('dashboard-all', 'job:initiated', payload);

    return { delivered: true, ts };
  });

  // POST /internal/notify/job-assigned
  // Called by scheduler when driver is dispatched
  app.post<{ Body: JobAssignedBody }>('/internal/notify/job-assigned', async (req) => {
    const { driver_id, vehicle_id, job_id, job_type, clusters, route, estimated_duration_min, planned_weight_kg, total_bins } = req.body;
    const ts = new Date().toISOString();
    slog('INFO', `/notify/job-assigned: job ${job_id} assigned to driver ${driver_id}`, {
      job_id, driver_id, vehicle_id, job_type, total_bins, cluster_count: clusters?.length,
    });

    const payload = {
      driver_id,
      vehicle_id,
      job_id,
      job_type,
      clusters,
      route,
      estimated_duration_min,
      planned_weight_kg,
      total_bins,
      timestamp: ts,
    };

    // 1. Emit via Socket.IO to driver room
    slog('DEBUG', `job-assigned: emitting to driver-${driver_id} room`, { job_id, driver_id });
    emitToRoom(`driver-${driver_id}`, 'job:assigned', payload);

    // 2. Send FCM push if driver not connected to Socket.IO
    const driverConnected = findConnectedSocket((socket) => socket.data.driverId === driver_id);
    slog('DEBUG', `job-assigned: driver ${driver_id} socket connected=${!!driverConnected}`, { job_id, driver_id, connected: !!driverConnected });
    if (!driverConnected) {
      slog('INFO', `job-assigned: driver ${driver_id} not connected — sending FCM push`, { job_id, driver_id });
      await sendPush(driver_id, {
        title: 'New collection job assigned',
        body: `You have a new ${job_type} collection — ${total_bins} bins`,
      }, {
        job_id,
        job_type,
        screen: 'job-detail',
      });
    }

    return { delivered: true, ts };
  });

  // POST /internal/notify/job-created
  // Called by orchestrator after successful dispatch — notifies dashboard
  app.post<{ Body: JobCreatedBody }>('/internal/notify/job-created', async (req) => {
    const { job_id, job_type, zone_id, zone_name, clusters, vehicle_id, driver_id, total_bins, planned_weight_kg, priority, route } = req.body;
    const ts = new Date().toISOString();
    slog('INFO', `/notify/job-created: job ${job_id}`, {
      job_id, job_type, zone_id, vehicle_id, driver_id, total_bins, priority, cluster_count: clusters?.length,
    });

    const payload = {
      job_id,
      job_type,
      zone_id,
      zone_name,
      clusters,
      vehicle_id,
      driver_id,
      total_bins,
      planned_weight_kg,
      priority,
      route,
      timestamp: ts,
    };

    // Emit to zone-specific rooms and fleet-ops
    slog('DEBUG', `job-created: emitting to dashboard-zone-${zone_id}, dashboard-all, fleet-ops`, { job_id, zone_id });
    emitToRoom(`dashboard-zone-${zone_id}`, 'job:created', payload);
    emitToRoom('dashboard-all', 'job:created', payload);
    emitToRoom('fleet-ops', 'job:created', payload);

    return { delivered: true, ts };
  });

  // POST /internal/notify/job-completed
  // Called by orchestrator when job reaches COMPLETED state
  app.post<{ Body: JobCompletedBody }>('/internal/notify/job-completed', async (req) => {
    const { job_id, zone_id, vehicle_id, driver_id, bins_collected, bins_skipped, actual_weight_kg, duration_minutes, hyperledger_tx_id } = req.body;
    const ts = new Date().toISOString();
    slog('INFO', `/notify/job-completed: job ${job_id}`, {
      job_id, zone_id, vehicle_id, driver_id, bins_collected, bins_skipped, actual_weight_kg, duration_minutes, has_tx_id: !!hyperledger_tx_id,
    });

    const payload = {
      job_id,
      zone_id,
      vehicle_id,
      driver_id,
      bins_collected,
      bins_skipped,
      actual_weight_kg,
      duration_minutes,
      hyperledger_tx_id,
      timestamp: ts,
    };

    // 1. Emit to dashboard
    emitToRoom(`dashboard-zone-${zone_id}`, 'job:completed', payload);
    emitToRoom('dashboard-all', 'job:completed', payload);
    emitToRoom('fleet-ops', 'job:completed', payload);

    // 2. Emit to driver
    emitToRoom(`driver-${driver_id}`, 'job:completed', { job_id, message: 'Job complete. Well done!', timestamp: ts });

    // 3. Optional FCM to driver if disconnected
    const driverConnected = findConnectedSocket((socket) => socket.data.driverId === driver_id);
    if (!driverConnected) {
      await sendPush(driver_id, {
        title: 'Job complete',
        body: 'Well done! Your collection job is complete.',
      }, {
        job_id,
        screen: 'home',
      });
    }

    return { delivered: true, ts };
  });

  // POST /internal/notify/job-cancelled
  // Called by orchestrator when job is cancelled
  app.post<{ Body: JobCancelledBody }>('/internal/notify/job-cancelled', async (req) => {
    const { job_id, zone_id, driver_id, reason } = req.body;
    const ts = new Date().toISOString();

    const payload = {
      job_id,
      zone_id,
      reason,
      timestamp: ts,
    };

    // 1. Notify dashboard
    emitToRoom(`dashboard-zone-${zone_id}`, 'job:cancelled', payload);
    emitToRoom('dashboard-all', 'job:cancelled', payload);

    // 2. Notify driver (if assigned)
    if (driver_id) {
      emitToRoom(`driver-${driver_id}`, 'job:cancelled', { job_id, reason, timestamp: ts });

      // FCM push if disconnected
      const driverConnected = findConnectedSocket((socket) => socket.data.driverId === driver_id);
      if (!driverConnected) {
        await sendPush(driver_id, {
          title: 'Job cancelled',
          body: reason,
        }, {
          job_id,
          screen: 'home',
        });
      }
    }

    return { delivered: true, ts };
  });

  // POST /internal/notify/job-escalated
  // Called by orchestrator when no vehicle can be found
  app.post<{ Body: JobEscalatedBody }>('/internal/notify/job-escalated', async (req) => {
    const { job_id, zone_id, reason, urgent_bins, total_weight_kg } = req.body;
    const ts = new Date().toISOString();

    const payload = {
      job_id,
      zone_id,
      reason,
      message: 'Emergency collection needs manual dispatch — no vehicle available',
      urgent_bins,
      total_weight_kg,
      timestamp: ts,
    };

    // Emit to zone and alert rooms
    emitToRoom(`dashboard-zone-${zone_id}`, 'alert:escalated', payload);
    emitToRoom('dashboard-all', 'alert:escalated', payload);
    emitToRoom('alerts-all', 'alert:escalated', payload);

    return { delivered: true, ts };
  });

  // POST /internal/notify/vehicle-position
  // Called by scheduler with enriched vehicle position (immediate, non-Kafka path)
  app.post<{ Body: VehiclePositionBody }>('/internal/notify/vehicle-position', async (req) => {
    const {
      vehicle_id, driver_id, job_id, zone_id, lat, lng, speed_kmh,
      cargo_weight_kg, cargo_limit_kg, cargo_utilisation_pct, bins_collected, bins_total,
      arrived_at_cluster, weight_limit_warning,
    } = req.body;
    const ts = new Date().toISOString();
    slog('DEBUG', `/notify/vehicle-position: ${vehicle_id}`, {
      vehicle_id, job_id, zone_id, lat, lng, speed_kmh, bins_collected, bins_total, cargo_utilisation_pct,
    });

    const payload = {
      vehicle_id, driver_id, job_id, zone_id, lat, lng, speed_kmh,
      cargo_weight_kg, cargo_limit_kg, cargo_utilisation_pct, bins_collected, bins_total,
      arrived_at_cluster, timestamp: ts,
    };

    // Emit vehicle position to dashboard and fleet-ops
    slog('DEBUG', `vehicle-position: emitting to dashboard-zone-${zone_id}, dashboard-all, fleet-ops`, { vehicle_id, zone_id });
    emitToRoom(`dashboard-zone-${zone_id}`, 'vehicle:position', payload);
    emitToRoom('dashboard-all', 'vehicle:position', payload);
    emitToRoom('fleet-ops', 'vehicle:position', payload);

    // If weight limit warning, also emit alert
    if (weight_limit_warning) {
      slog('WARN', `vehicle-position: weight limit warning for ${vehicle_id}`, {
        vehicle_id, cargo_utilisation_pct, cargo_weight_kg, cargo_limit_kg,
      });
      const alertPayload = {
        vehicle_id,
        driver_id,
        cargo_utilisation_pct,
        message: `Vehicle ${vehicle_id} cargo at ${cargo_utilisation_pct}% capacity`,
        timestamp: ts,
      };
      emitToRoom('fleet-ops', 'alert:weight-limit', alertPayload);
      emitToRoom('dashboard-all', 'alert:weight-limit', alertPayload);
    }

    return { delivered: true, ts };
  });

  // POST /internal/notify/alert-deviation
  // Called by scheduler when vehicle is off route
  app.post<{ Body: AlertDeviationBody }>('/internal/notify/alert-deviation', async (req) => {
    const { vehicle_id, driver_id, job_id, zone_id, deviation_metres, duration_seconds, message } = req.body;
    const ts = new Date().toISOString();

    const payload = {
      vehicle_id,
      driver_id,
      job_id,
      zone_id,
      deviation_metres,
      duration_seconds,
      message,
      timestamp: ts,
    };

    // Emit to fleet-ops and zone-specific rooms
    emitToRoom('fleet-ops', 'alert:deviation', payload);
    emitToRoom(`dashboard-zone-${zone_id}`, 'alert:deviation', payload);
    emitToRoom('alerts-all', 'alert:deviation', payload);

    return { delivered: true, ts };
  });
}

