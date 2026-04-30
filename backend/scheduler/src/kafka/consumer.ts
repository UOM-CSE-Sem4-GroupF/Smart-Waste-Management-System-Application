import { Kafka, logLevel, Producer } from 'kafkajs';
import { vehicles, drivers, activeJobs, binCollectionRecords, routePlans } from '../store';
import { VehicleLocationEvent, VehicleDeviationEvent, VehiclePositionUpdate } from '../types';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler', message: msg }) + '\n');

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;

  return new Kafka({
    clientId: 'scheduler-service',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

let producer: Producer;

export async function startKafkaConsumer(): Promise<void> {
  const kafka = buildKafka();
  producer = kafka.producer();
  await producer.connect();

  const consumer = kafka.consumer({ groupId: 'scheduler-vehicle-tracker' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.vehicle.location', fromBeginning: false });
  await consumer.subscribe({ topic: 'waste.vehicle.deviation', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());

        if (topic === 'waste.vehicle.location') {
          await handleVehicleLocation(envelope as VehicleLocationEvent);
        } else if (topic === 'waste.vehicle.deviation') {
          await handleVehicleDeviation(envelope as VehicleDeviationEvent);
        }
      } catch (e) {
        slog('ERROR', `Message handler error: ${e}`);
      }
    },
  });
}

async function handleVehicleLocation(event: VehicleLocationEvent): Promise<void> {
  const { payload } = event;
  const { vehicle_id, driver_id, lat, lng, speed_kmh, heading_degrees, accuracy_m } = payload;

  // Update vehicle position
  const vehicle = vehicles.get(vehicle_id);
  if (vehicle) {
    vehicle.lat = lat;
    vehicle.lng = lng;
  }

  // Find active job for this vehicle
  const activeJob = Array.from(activeJobs.values()).find(
    job => job.assigned_vehicle_id === vehicle_id && job.state === 'IN_PROGRESS'
  );

  if (!activeJob) {
    // Throttle position updates for non-active jobs
    // In real implementation, would check last update time
    return;
  }

  // Enrich with job context
  const routePlan = Array.from(routePlans.values()).find(rp => rp.job_id === activeJob.job_id);
  const binRecords = Array.from(binCollectionRecords.values()).filter(br => br.job_id === activeJob.job_id);

  const binsCollected = binRecords.filter(br => br.collected_at).length;
  const binsTotal = binRecords.length;
  const cargoWeightKg = binRecords
    .filter(br => br.collected_at)
    .reduce((sum, br) => sum + (br.actual_weight_kg || br.estimated_weight_kg), 0);

  const vehicleInfo = vehicles.get(vehicle_id);
  const cargoLimitKg = vehicleInfo?.max_cargo_kg || 0;
  const cargoUtilisationPct = cargoLimitKg > 0 ? (cargoWeightKg / cargoLimitKg) * 100 : 0;

  // Proximity check - mark bins as arrived if within 50m
  let arrivedAtBin: string | undefined;
  for (const binRecord of binRecords) {
    if (binRecord.arrived_at || binRecord.collected_at || binRecord.skipped_at) continue;

    // Mock bin location - in real system would look up from bin data
    const binLat = lat + (Math.random() - 0.5) * 0.01; // Mock location near vehicle
    const binLng = lng + (Math.random() - 0.5) * 0.01;

    const distance = haversineKm(lat, lng, binLat, binLng);
    if (distance < 0.05) { // 50m
      binRecord.arrived_at = new Date().toISOString();
      arrivedAtBin = binRecord.bin_id;
      break;
    }
  }

  // Determine current cluster
  let currentCluster: string | undefined;
  let nextCluster: string | undefined;
  if (routePlan) {
    // Find current cluster based on route progress
    const completedClusters = new Set(
      binRecords.filter(br => br.collected_at).map(br => {
        const waypoint = routePlan.waypoints.find(w => w.bins.includes(br.bin_id));
        return waypoint?.cluster_id;
      }).filter(Boolean)
    );

    for (const waypoint of routePlan.waypoints) {
      if (!completedClusters.has(waypoint.cluster_id)) {
        currentCluster = waypoint.cluster_id;
        break;
      }
    }

    // Find next cluster
    if (currentCluster) {
      const currentIndex = routePlan.waypoints.findIndex(w => w.cluster_id === currentCluster);
      if (currentIndex >= 0 && currentIndex + 1 < routePlan.waypoints.length) {
        nextCluster = routePlan.waypoints[currentIndex + 1].cluster_id;
      }
    }
  }

  // Check weight limit warning
  const weightLimitWarning = cargoWeightKg >= cargoLimitKg * 0.9;

  // Create enriched update
  const update: VehiclePositionUpdate = {
    event_type: 'vehicle:position',
    vehicle_id,
    driver_id,
    job_id: activeJob.job_id,
    lat,
    lng,
    speed_kmh,
    heading_degrees,
    accuracy_m,
    current_cluster: currentCluster,
    next_cluster: nextCluster,
    bins_collected: binsCollected,
    bins_total: binsTotal,
    cargo_weight_kg: cargoWeightKg,
    cargo_limit_kg: cargoLimitKg,
    cargo_utilisation_pct: cargoUtilisationPct,
    arrived_at_bin: arrivedAtBin,
    weight_limit_warning: weightLimitWarning
  };

  // Publish to waste.vehicle.dashboard.updates
  await producer.send({
    topic: 'waste.vehicle.dashboard.updates',
    messages: [{ value: JSON.stringify(update) }]
  });

  // In real system, would also write to InfluxDB
  slog('INFO', `Published position update for ${vehicle_id}`);
}

async function handleVehicleDeviation(event: VehicleDeviationEvent): Promise<void> {
  const { payload } = event;
  const { vehicle_id, job_id, deviation_metres, duration_seconds, current_lat, current_lng } = payload;

  const job = activeJobs.get(job_id);
  if (!job) return;

  const driver = drivers.get(job.assigned_driver_id);
  if (!driver) return;

  const message = `${vehicles.get(vehicle_id)?.name || vehicle_id} is ${deviation_metres}m off planned route`;

  // Call notification service
  // In real system: POST /internal/notify/alert-deviation
  slog('WARN', `Deviation alert: ${message}`);

  // Mock notification - in real system would make HTTP call to notification service
  const alert = {
    vehicle_id,
    driver_id: driver.driver_id,
    job_id,
    deviation_metres,
    duration_seconds,
    message
  };

  // Forward to notification service topic or direct call
  await producer.send({
    topic: 'waste.notifications.alerts',
    messages: [{ value: JSON.stringify(alert) }]
  });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
