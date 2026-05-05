import { startManualConsumer } from './manualConsumer';
import { emitToRoom } from '../socket';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');

export function handle(topic: string, event: DashboardUpdateEvent | VehicleUpdateEvent, timestamp: string): void {
  switch (topic) {
    case 'waste.bin.dashboard.updates': {
      const binEvent = event as DashboardUpdateEvent;
      const { event_type, payload } = binEvent;

      switch (event_type) {
        case 'bin:update': {
          const binPayload = payload as BinUpdatePayload;
          emitToRoom(`dashboard-zone-${binPayload.zone_id}`, 'bin:update', { ...binPayload, timestamp });
          emitToRoom('dashboard-all', 'bin:update', { ...binPayload, timestamp });
          break;
        }

        case 'zone:stats': {
          const zonePayload = payload as ZoneStatsPayload;
          emitToRoom(`dashboard-zone-${zonePayload.zone_id}`, 'zone:stats', { ...zonePayload, timestamp });
          emitToRoom('dashboard-all', 'zone:stats', { ...zonePayload, timestamp });
          break;
        }

        case 'alert:urgent': {
          const alertPayload = payload as AlertPayload;
          emitToRoom(`dashboard-zone-${alertPayload.zone_id}`, 'alert:urgent', { ...alertPayload, timestamp });
          emitToRoom('dashboard-all', 'alert:urgent', { ...alertPayload, timestamp });
          emitToRoom('alerts-all', 'alert:urgent', { ...alertPayload, timestamp });
          break;
        }
      }
      break;
    }

    case 'waste.vehicle.dashboard.updates': {
      const vehicleEvent = event as VehicleUpdateEvent;
      const { event_type, payload } = vehicleEvent;

      switch (event_type) {
        case 'vehicle:position': {
          const posPayload = payload as VehiclePositionPayload;
          emitToRoom(`dashboard-zone-${posPayload.zone_id}`, 'vehicle:position', { ...posPayload, timestamp });
          emitToRoom('dashboard-all', 'vehicle:position', { ...posPayload, timestamp });
          emitToRoom('fleet-ops', 'vehicle:position', { ...posPayload, timestamp });
          break;
        }

        case 'job:progress': {
          const jobPayload = payload as JobProgressPayload;
          emitToRoom(`dashboard-zone-${jobPayload.zone_id}`, 'job:progress', { ...jobPayload, timestamp });
          emitToRoom('dashboard-all', 'job:progress', { ...jobPayload, timestamp });
          break;
        }
      }
      break;
    }
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
  vehicle_id: string;
  zone_id: number;
  lat: number;
  lng: number;
  speed_kmh: number;
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
  // 1. Bin Dashboard Updates
  await startManualConsumer(
    'notification-service-bin-updates',
    'waste.bin.dashboard.updates',
    async (value) => {
      try {
        const envelope = JSON.parse(value.toString());
        const event = envelope as DashboardUpdateEvent;
        const timestamp = String(envelope.timestamp ?? new Date().toISOString());
        handle('waste.bin.dashboard.updates', event, timestamp);
      } catch (e) {
        slog('ERROR', `Handler error on waste.bin.dashboard.updates: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    slog
  );

  // 2. Vehicle Dashboard Updates
  await startManualConsumer(
    'notification-service-vehicle-updates',
    'waste.vehicle.dashboard.updates',
    async (value) => {
      try {
        const envelope = JSON.parse(value.toString());
        const event = envelope as VehicleUpdateEvent;
        const timestamp = String(envelope.timestamp ?? new Date().toISOString());
        handle('waste.vehicle.dashboard.updates', event, timestamp);
      } catch (e) {
        slog('ERROR', `Handler error on waste.vehicle.dashboard.updates: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    slog
  );

  slog('INFO', 'Kafka manual consumers started for notification service');
}

