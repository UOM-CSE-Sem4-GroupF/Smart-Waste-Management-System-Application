import { startManualConsumer } from './manualConsumer';
import { emitToRoom } from '../socket';

const slog = (level: string, msg: string, extra?: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification:kafka', message: msg, ...extra }) + '\n');

export function handle(topic: string, event: DashboardUpdateEvent | VehicleUpdateEvent, timestamp: string): void {
  switch (topic) {
    case 'waste.bin.dashboard.updates': {
      const binEvent = event as DashboardUpdateEvent;
      const { event_type, payload } = binEvent;

      slog('DEBUG', `handle: waste.bin.dashboard.updates event_type=${event_type}`, { event_type, topic });

      switch (event_type) {
        case 'bin:update': {
          const binPayload = payload as BinUpdatePayload;
          slog('DEBUG', `bin:update for bin ${binPayload.bin_id}`, {
            bin_id:        binPayload.bin_id,
            zone_id:       binPayload.zone_id,
            urgency_score: binPayload.urgency_score,
            fill_level:    binPayload.fill_level_pct,
          });
          emitToRoom(`dashboard-zone-${binPayload.zone_id}`, 'bin:update', { ...binPayload, timestamp });
          emitToRoom('dashboard-all', 'bin:update', { ...binPayload, timestamp });
          slog('DEBUG', `bin:update emitted to dashboard-zone-${binPayload.zone_id} and dashboard-all`, { bin_id: binPayload.bin_id });
          break;
        }

        case 'zone:stats': {
          const zonePayload = payload as ZoneStatsPayload;
          slog('DEBUG', `zone:stats for zone ${zonePayload.zone_id}`, {
            zone_id:       zonePayload.zone_id,
            avg_fill:      zonePayload.avg_fill,
            total_bins:    zonePayload.total_bins,
          });
          emitToRoom(`dashboard-zone-${zonePayload.zone_id}`, 'zone:stats', { ...zonePayload, timestamp });
          emitToRoom('dashboard-all', 'zone:stats', { ...zonePayload, timestamp });
          slog('DEBUG', `zone:stats emitted to dashboard-zone-${zonePayload.zone_id} and dashboard-all`, { zone_id: zonePayload.zone_id });
          break;
        }

        case 'alert:urgent': {
          const alertPayload = payload as AlertPayload;
          slog('WARN', `alert:urgent for bin ${alertPayload.bin_id} in zone ${alertPayload.zone_id}`, {
            bin_id:        alertPayload.bin_id,
            zone_id:       alertPayload.zone_id,
            urgency_score: alertPayload.urgency_score,
          });
          emitToRoom(`dashboard-zone-${alertPayload.zone_id}`, 'alert:urgent', { ...alertPayload, timestamp });
          emitToRoom('dashboard-all', 'alert:urgent', { ...alertPayload, timestamp });
          emitToRoom('alerts-all', 'alert:urgent', { ...alertPayload, timestamp });
          slog('DEBUG', `alert:urgent emitted to 3 rooms`, { bin_id: alertPayload.bin_id, zone_id: alertPayload.zone_id });
          break;
        }

        default:
          slog('WARN', `handle: unknown event_type on waste.bin.dashboard.updates: ${event_type}`, { event_type });
      }
      break;
    }

    case 'waste.vehicle.dashboard.updates': {
      const vehicleEvent = event as VehicleUpdateEvent;
      const { event_type, payload } = vehicleEvent;

      slog('DEBUG', `handle: waste.vehicle.dashboard.updates event_type=${event_type}`, { event_type, topic });

      switch (event_type) {
        case 'vehicle:position': {
          const posPayload = payload as VehiclePositionPayload;
          slog('DEBUG', `vehicle:position for ${posPayload.vehicle_id}`, {
            vehicle_id:            posPayload.vehicle_id,
            job_id:                posPayload.job_id,
            zone_id:               posPayload.zone_id,
            lat:                   posPayload.lat,
            lng:                   posPayload.lng,
            speed_kmh:             posPayload.speed_kmh,
            heading_degrees:       posPayload.heading_degrees,
            bins_collected:        posPayload.bins_collected,
            bins_total:            posPayload.bins_total,
            cargo_utilisation_pct: posPayload.cargo_utilisation_pct,
            current_cluster:       posPayload.current_cluster,
            arrived_at_bin:        posPayload.arrived_at_bin,
          });
          emitToRoom(`dashboard-zone-${posPayload.zone_id}`, 'vehicle:position', { ...posPayload, timestamp });
          emitToRoom('dashboard-all', 'vehicle:position', { ...posPayload, timestamp });
          emitToRoom('fleet-ops', 'vehicle:position', { ...posPayload, timestamp });
          slog('DEBUG', `vehicle:position emitted to dashboard-zone-${posPayload.zone_id}, dashboard-all, fleet-ops`, {
            vehicle_id: posPayload.vehicle_id, zone_id: posPayload.zone_id,
          });
          break;
        }

        case 'job:progress': {
          const jobPayload = payload as JobProgressPayload;
          slog('DEBUG', `job:progress for job ${jobPayload.job_id}`, {
            job_id:         jobPayload.job_id,
            zone_id:        jobPayload.zone_id,
            vehicle_id:     jobPayload.vehicle_id,
            bins_collected: jobPayload.bins_collected,
            bins_total:     jobPayload.bins_total,
          });
          emitToRoom(`dashboard-zone-${jobPayload.zone_id}`, 'job:progress', { ...jobPayload, timestamp });
          emitToRoom('dashboard-all', 'job:progress', { ...jobPayload, timestamp });
          slog('DEBUG', `job:progress emitted to dashboard-zone-${jobPayload.zone_id} and dashboard-all`, { job_id: jobPayload.job_id });
          break;
        }

        default:
          slog('WARN', `handle: unknown event_type on waste.vehicle.dashboard.updates: ${event_type}`, { event_type });
      }
      break;
    }

    default:
      slog('WARN', `handle: unknown topic: ${topic}`, { topic });
  }
}

// Kafka message envelope structures
interface BinUpdatePayload {
  bin_id: string;
  zone_id: number;
  fill_level_pct: number;
  urgency_score: number;
}

interface ZoneStatsPayload {
  zone_id: number;
  avg_fill: number;
  total_bins: number;
}

interface AlertPayload {
  zone_id: number;
  bin_id: string;
  urgency_score: number;
  predicted_full_at?: string;
}

interface VehiclePositionPayload {
  vehicle_id:            string;
  driver_id:             string;
  job_id:                string;
  zone_id:               number;
  lat:                   number;
  lng:                   number;
  speed_kmh:             number;
  heading_degrees:       number;
  accuracy_m:            number;
  current_cluster?:      string;
  next_cluster?:         string;
  bins_collected:        number;
  bins_total:            number;
  cargo_weight_kg:       number;
  cargo_limit_kg:        number;
  cargo_utilisation_pct: number;
  arrived_at_bin?:       string;
  weight_limit_warning?: boolean;
  timestamp?:            string;
}

interface JobProgressPayload {
  job_id: string;
  zone_id: number;
  vehicle_id: string;
  bins_collected: number;
  bins_total: number;
}

interface DashboardUpdateEvent {
  event_type: 'bin:update' | 'zone:stats' | 'alert:urgent';
  payload: BinUpdatePayload | ZoneStatsPayload | AlertPayload;
  timestamp?: string;
}

interface VehicleUpdateEvent {
  event_type: 'vehicle:position' | 'job:progress';
  payload: VehiclePositionPayload | JobProgressPayload;
  timestamp?: string;
}

export async function startKafkaConsumer(): Promise<void> {
  slog('INFO', 'Starting Kafka consumers for notification service');

  // 1. Bin Dashboard Updates
  await startManualConsumer(
    'notification-service-bin-updates',
    'waste.bin.dashboard.updates',
    async (value) => {
      try {
        const raw = value.toString();
        const envelope = JSON.parse(raw);
        const event = envelope as DashboardUpdateEvent;
        const timestamp = String(envelope.timestamp ?? new Date().toISOString());
        slog('DEBUG', `waste.bin.dashboard.updates message received`, {
          event_type: envelope.event_type,
          has_payload: !!envelope.payload,
        });
        handle('waste.bin.dashboard.updates', event, timestamp);
      } catch (e) {
        slog('ERROR', `Handler error on waste.bin.dashboard.updates: ${e instanceof Error ? e.message : String(e)}`, {
          error: String(e),
        });
      }
    },
    (level, msg) => slog(level, msg),
  );

  // 2. Vehicle Dashboard Updates
  await startManualConsumer(
    'notification-service-vehicle-updates',
    'waste.vehicle.dashboard.updates',
    async (value) => {
      try {
        const raw = value.toString();
        const envelope = JSON.parse(raw);
        const event = envelope as VehicleUpdateEvent;
        const timestamp = String(envelope.timestamp ?? new Date().toISOString());
        slog('DEBUG', `waste.vehicle.dashboard.updates message received`, {
          event_type:  envelope.event_type,
          has_payload: !!envelope.payload,
          vehicle_id:  envelope.payload?.vehicle_id,
        });
        handle('waste.vehicle.dashboard.updates', event, timestamp);
      } catch (e) {
        slog('ERROR', `Handler error on waste.vehicle.dashboard.updates: ${e instanceof Error ? e.message : String(e)}`, {
          error: String(e),
        });
      }
    },
    (level, msg) => slog(level, msg),
  );

  slog('INFO', 'Kafka manual consumers started for notification service — subscribed to waste.bin.dashboard.updates, waste.vehicle.dashboard.updates');
}

