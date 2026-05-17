import { vehicles, activeJobs, binCollectionRecords, routePlans, clusterCoordinates } from '../store';
import { VehicleLocationEvent, VehicleDeviationEvent, VehiclePositionUpdate } from '../types';
import { startManualConsumer } from './manualConsumer';
import { createManualProducer, ManualProducer } from './manualProducer';

const slog = (level: string, msg: string, extra?: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler:kafka', message: msg, ...extra }) + '\n');

let producer: ManualProducer;

// Movement deduplication: skip publish if vehicle hasn't moved enough recently
const lastPublished = new Map<string, { lat: number; lng: number; ts: number }>();

export async function startKafkaConsumer(): Promise<void> {
  producer = await createManualProducer('scheduler-service-publisher');

  await startManualConsumer(
    'scheduler-service-location',
    'waste.vehicle.location',
    async (value) => {
      try {
        const envelope = JSON.parse(value.toString());
        // Flink wraps in { version, source_service, timestamp, payload: { vehicle_id, lat, lon, ... } }
        const event = (envelope.payload ?? envelope) as VehicleLocationEvent;
        await handleVehicleLocation(event);
      } catch (e) {
        slog('ERROR', `Location handler error: ${e}`);
      }
    },
    slog
  );

  await startManualConsumer(
    'scheduler-service-deviation',
    'waste.vehicle.deviation',
    async (value) => {
      try {
        const envelope = JSON.parse(value.toString());
        await handleVehicleDeviation(envelope as VehicleDeviationEvent);
      } catch (e) {
        slog('ERROR', `Deviation handler error: ${e}`);
      }
    },
    slog
  );
}

async function handleVehicleLocation(event: VehicleLocationEvent): Promise<void> {
  // Bug 0: actual payload is flat with lon/speed/heading (not lng/speed_kmh/heading_degrees)
  const { vehicle_id, lat, lon: lng, speed: speed_kmh, heading: heading_degrees, timestamp } = event;

  slog('DEBUG', `handleVehicleLocation: received position for ${vehicle_id}`, {
    vehicle_id, lat, lng, speed_kmh, heading_degrees, raw_timestamp: timestamp,
  });

  // Resolve driver from vehicles store (not in the Kafka message)
  const vehicle = vehicles.get(vehicle_id);
  const driver_id = vehicle?.driver_id ?? '';

  if (!vehicle) {
    slog('WARN', `handleVehicleLocation: vehicle ${vehicle_id} not in store — no metadata`, { vehicle_id });
  }

  // Update vehicle position in store
  if (vehicle) {
    vehicle.lat = lat;
    vehicle.lng = lng;
  }

  // Movement deduplication — applies to all vehicles regardless of job state
  const now = Date.now();
  const last = lastPublished.get(vehicle_id);
  if (last) {
    const movedKm   = haversineKm(last.lat, last.lng, lat, lng);
    const elapsedMs = now - last.ts;
    if (movedKm < 0.01 && elapsedMs < 30_000) {
      slog('DEBUG', `handleVehicleLocation: dedup skip for ${vehicle_id} — moved ${(movedKm * 1000).toFixed(1)}m in ${elapsedMs}ms`, {
        vehicle_id, moved_m: (movedKm * 1000).toFixed(1), elapsed_ms: elapsedMs,
      });
      return;
    }
    slog('DEBUG', `handleVehicleLocation: dedup pass for ${vehicle_id} — moved ${(movedKm * 1000).toFixed(1)}m`, {
      vehicle_id, moved_m: (movedKm * 1000).toFixed(1), elapsed_ms: elapsedMs,
    });
  }

  // Find active or dispatched job for this vehicle
  const activeJob = Array.from(activeJobs.values()).find(
    job => job.assigned_vehicle_id === vehicle_id &&
           (job.state === 'IN_PROGRESS' || job.state === 'DISPATCHED')
  );

  if (!activeJob) {
    // No active job — publish idle position so the map still shows the vehicle
    slog('DEBUG', `handleVehicleLocation: no active job for ${vehicle_id} — publishing idle position`, {
      vehicle_id, lat, lng, known_jobs: activeJobs.size,
    });
    const idleUpdate: VehiclePositionUpdate = {
      event_type:            'vehicle:position',
      vehicle_id,
      driver_id,
      job_id:                '',
      zone_id:               vehicle?.zone_id ?? 0,
      lat,
      lng,
      speed_kmh,
      heading_degrees,
      accuracy_m:            0,
      bins_collected:        0,
      bins_total:            0,
      cargo_weight_kg:       0,
      cargo_limit_kg:        vehicle?.max_cargo_kg ?? 0,
      cargo_utilisation_pct: 0,
    };
    await publish(vehicle_id, idleUpdate, timestamp);
    lastPublished.set(vehicle_id, { lat, lng, ts: now });
    return;
  }

  slog('DEBUG', `handleVehicleLocation: found active job ${activeJob.job_id} for ${vehicle_id}`, {
    vehicle_id, job_id: activeJob.job_id, job_state: activeJob.state, zone_id: activeJob.zone_id,
  });

  // Gap 6: DISPATCHED — vehicle assigned but job not yet started, send minimal update
  if (activeJob.state === 'DISPATCHED') {
    slog('DEBUG', `handleVehicleLocation: vehicle ${vehicle_id} in DISPATCHED state — sending minimal update`, {
      vehicle_id, job_id: activeJob.job_id, lat, lng,
    });
    const update: VehiclePositionUpdate = {
      event_type:            'vehicle:position',
      vehicle_id,
      driver_id,
      job_id:                activeJob.job_id,
      zone_id:               activeJob.zone_id,
      lat,
      lng,
      speed_kmh,
      heading_degrees,
      accuracy_m:            0,
      bins_collected:        0,
      bins_total:            activeJob.total_bins,
      cargo_weight_kg:       0,
      cargo_limit_kg:        vehicle?.max_cargo_kg ?? 0,
      cargo_utilisation_pct: 0,
    };
    await publish(vehicle_id, update, timestamp);
    lastPublished.set(vehicle_id, { lat, lng, ts: now });
    return;
  }

  // IN_PROGRESS — full enrichment with route plan context
  const routePlan = Array.from(routePlans.values()).find(rp => rp.job_id === activeJob.job_id);
  const binRecords = Array.from(binCollectionRecords.values()).filter(br => br.job_id === activeJob.job_id);

  slog('DEBUG', `handleVehicleLocation: IN_PROGRESS enrichment for ${vehicle_id}`, {
    vehicle_id,
    job_id:         activeJob.job_id,
    has_route_plan: !!routePlan,
    route_plan_id:  routePlan?.route_plan_id,
    bin_records:    binRecords.length,
  });

  const binsCollected    = binRecords.filter(br => br.collected_at).length;
  const binsTotal        = binRecords.length;
  const cargoWeightKg    = binRecords
    .filter(br => br.collected_at)
    .reduce((sum, br) => sum + (br.actual_weight_kg || br.estimated_weight_kg), 0);
  const cargoLimitKg     = vehicle?.max_cargo_kg ?? 0;
  const cargoUtilisationPct = cargoLimitKg > 0 ? (cargoWeightKg / cargoLimitKg) * 100 : 0;

  // Bug 4: proximity check using real cluster coordinates (not random)
  let arrivedAtBin: string | undefined;
  if (routePlan) {
    for (const binRecord of binRecords) {
      if (binRecord.arrived_at || binRecord.collected_at || binRecord.skipped_at) continue;

      const waypoint = routePlan.waypoints.find(w => w.bins.includes(binRecord.bin_id));
      if (waypoint) {
        const coords = clusterCoordinates.get(waypoint.cluster_id);
        if (coords && haversineKm(lat, lng, coords.lat, coords.lng) < 0.05) {
          binRecord.arrived_at = new Date().toISOString();
          arrivedAtBin = binRecord.bin_id;
          break;
        }
      }
    }
  }

  // Determine current and next cluster along the route
  let currentCluster: string | undefined;
  let nextCluster: string | undefined;
  if (routePlan) {
    const completedClusters = new Set(
      binRecords
        .filter(br => br.collected_at)
        .map(br => routePlan.waypoints.find(w => w.bins.includes(br.bin_id))?.cluster_id)
        .filter(Boolean) as string[]
    );

    for (const waypoint of routePlan.waypoints) {
      if (!completedClusters.has(waypoint.cluster_id)) {
        currentCluster = waypoint.cluster_id;
        break;
      }
    }

    if (currentCluster) {
      const idx = routePlan.waypoints.findIndex(w => w.cluster_id === currentCluster);
      if (idx >= 0 && idx + 1 < routePlan.waypoints.length) {
        nextCluster = routePlan.waypoints[idx + 1].cluster_id;
      }
    }
  }

  // Bug 2: include zone_id in update
  const update: VehiclePositionUpdate = {
    event_type:            'vehicle:position',
    vehicle_id,
    driver_id,
    job_id:                activeJob.job_id,
    zone_id:               activeJob.zone_id,
    lat,
    lng,
    speed_kmh,
    heading_degrees,
    accuracy_m:            0,
    current_cluster:       currentCluster,
    next_cluster:          nextCluster,
    bins_collected:        binsCollected,
    bins_total:            binsTotal,
    cargo_weight_kg:       cargoWeightKg,
    cargo_limit_kg:        cargoLimitKg,
    cargo_utilisation_pct: cargoUtilisationPct,
    arrived_at_bin:        arrivedAtBin,
    weight_limit_warning:  cargoWeightKg >= cargoLimitKg * 0.9,
  };

  slog('INFO', `Publishing position update for ${vehicle_id}`, {
    vehicle_id,
    job_id:                activeJob.job_id,
    lat, lng,
    speed_kmh,
    heading_degrees,
    bins_collected:        binsCollected,
    bins_total:            binsTotal,
    cargo_utilisation_pct: parseFloat(cargoUtilisationPct.toFixed(1)),
    current_cluster:       currentCluster,
    next_cluster:          nextCluster,
    arrived_at_bin:        arrivedAtBin,
    weight_limit_warning:  cargoWeightKg >= cargoLimitKg * 0.9,
  });

  await publish(vehicle_id, update, timestamp);
  lastPublished.set(vehicle_id, { lat, lng, ts: now });
  slog('INFO', `Published position update for ${vehicle_id}`, { vehicle_id, job_id: activeJob.job_id });
}

// Bug 1: wrap in envelope format that notification consumer expects
async function publish(vehicle_id: string, update: VehiclePositionUpdate, eventTimestamp: number): Promise<void> {
  await producer.send(
    'waste.vehicle.dashboard.updates',
    vehicle_id,
    JSON.stringify({
      event_type: 'vehicle:position',
      payload:    { ...update, timestamp: new Date(eventTimestamp).toISOString() },
    })
  );
}

async function handleVehicleDeviation(event: VehicleDeviationEvent): Promise<void> {
  const { payload } = event;
  const { vehicle_id, job_id, deviation_metres, duration_seconds, current_lat, current_lng } = payload;

  const job    = activeJobs.get(job_id);
  if (!job) return;

  const vehicle = vehicles.get(vehicle_id);
  const message = `${vehicle?.name ?? vehicle_id} is ${deviation_metres}m off planned route`;
  slog('WARN', `Deviation alert: ${message}`);

  const NOTIFICATION_URL = process.env.NOTIFICATION_URL ?? 'http://notification:3004';
  fetch(`${NOTIFICATION_URL}/internal/notify/alert-deviation`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicle_id,
      driver_id:        vehicle?.driver_id ?? '',
      job_id,
      zone_id:          job.zone_id,
      deviation_metres,
      duration_seconds,
      message,
    }),
  }).catch(e => slog('WARN', `Deviation notification failed: ${(e as Error).message}`));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
