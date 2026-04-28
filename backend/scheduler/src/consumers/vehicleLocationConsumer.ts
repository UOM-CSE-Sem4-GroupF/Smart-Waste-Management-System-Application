import { Kafka, logLevel } from 'kafkajs';
import { VehicleLocationEvent } from '../types';
import { vehicles, getRoutePlanByJob, getJobProgressSummary, getJobBins, markBinArrived } from '../db/queries';
import { notifyVehiclePosition } from '../clients/notificationClient';
import { haversineMetres } from '../dispatch/nearestNeighbour';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'scheduler-vehicle-tracker',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } } : {}),
  });
}

// Throttle: track last-forwarded timestamp for idle vehicles
const lastForwardedAt = new Map<string, number>();
const THROTTLE_MS     = 30_000;

export async function handleVehicleLocationEvent(event: VehicleLocationEvent): Promise<void> {
  const p = event.payload;
  const vehicle = vehicles.get(p.vehicle_id);
  if (!vehicle) return;

  // Update position
  vehicle.lat         = p.lat;
  vehicle.lng         = p.lng;
  vehicle.heading     = p.heading_degrees;
  vehicle.speed_kmh   = p.speed_kmh;
  vehicle.last_update = event.timestamp ?? new Date().toISOString();

  // Find active job for this vehicle
  const job_id     = vehicle.current_job_id;
  const routePlan  = job_id ? getRoutePlanByJob(job_id) : undefined;
  const progress   = job_id ? getJobProgressSummary(job_id) : undefined;

  // Smart filtering: skip idle vehicles (not on active job and not throttled)
  if (!job_id || !routePlan || !progress) {
    const last = lastForwardedAt.get(p.vehicle_id) ?? 0;
    if (Date.now() - last < THROTTLE_MS) return;
    lastForwardedAt.set(p.vehicle_id, Date.now());
    return;
  }

  // Proximity check — mark arrived if within 50m of any pending bin
  let arrivedAtCluster: string | undefined;
  const bins = getJobBins(job_id);
  for (const bin of bins) {
    if (bin.status !== 'pending') continue;
    const dist = haversineMetres(p.lat, p.lng, bin.lat, bin.lng);
    if (dist < 50) {
      markBinArrived(job_id, bin.bin_id);
      arrivedAtCluster = bin.cluster_id;
    }
  }

  const weight_limit_warning = progress.cargo_limit_kg > 0
    && progress.cargo_weight_kg >= progress.cargo_limit_kg * 0.9;

  await notifyVehiclePosition({
    vehicle_id:            p.vehicle_id,
    driver_id:             p.driver_id,
    job_id,
    zone_id:               routePlan.zone_id,
    lat:                   p.lat,
    lng:                   p.lng,
    speed_kmh:             p.speed_kmh,
    cargo_weight_kg:       progress.cargo_weight_kg,
    cargo_limit_kg:        progress.cargo_limit_kg,
    cargo_utilisation_pct: progress.cargo_utilisation_pct,
    bins_collected:        progress.bins_collected,
    bins_total:            progress.bins_collected + progress.bins_skipped + progress.bins_pending,
    ...(arrivedAtCluster  ? { arrived_at_cluster: arrivedAtCluster } : {}),
    ...(weight_limit_warning ? { weight_limit_warning: true }       : {}),
  });
}

export async function startVehicleLocationConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'scheduler-vehicle-tracker' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.vehicle.location', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as VehicleLocationEvent;
        await handleVehicleLocationEvent(event);
      } catch (e) {
        slog('ERROR', `vehicle.location handler error: ${e}`);
      }
    },
  });

  slog('INFO', 'Consumer ready — waste.vehicle.location (scheduler-vehicle-tracker)');
}
