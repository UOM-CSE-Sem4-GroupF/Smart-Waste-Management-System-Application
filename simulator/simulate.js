#!/usr/bin/env node
'use strict';

/**
 * Garabadge Kafka Simulator
 *
 * Publishes realistic events directly to Kafka topics consumed by the backend services:
 *
 *   waste.bin.processed          → bin-status service + orchestrator (emergency trigger)
 *   waste.vehicle.location       → scheduler (vehicle tracker)
 *   waste.vehicle.deviation      → scheduler (deviation handler), every ~45s
 *   waste.routine.schedule.trigger → orchestrator, fired once per zone on startup
 *
 * Partition note: waste.bin.processed and waste.vehicle.location have 6 partitions.
 * Partitions 1, 3, 4 are led by Broker 0 which is unreachable from outside the cluster.
 * This simulator explicitly produces only to partitions [0, 2, 5] for those topics.
 */

const { Kafka, logLevel } = require('kafkajs');

// ── Connection ────────────────────────────────────────────────────────────────
// Local:  KAFKA_BROKER=localhost:9092 (no KAFKA_USER/KAFKA_PASS → plain)
// Remote: DOKS external load balancer (default)
const BROKER     = process.env.KAFKA_BROKER || '163.47.8.3:9094';
const KAFKA_USER = process.env.KAFKA_USER   || 'user1';
const KAFKA_PASS = process.env.KAFKA_PASS   || 'QA7aKGtPHV';

// Safe partitions for 6-partition topics (Broker 0 partitions 1,3,4 are unreachable
// on the remote AWS cluster; irrelevant for local single-broker Kafka).
const SAFE_6 = [0, 2, 5];
// For 3-partition topics we use partition 0 (controller broker, always reachable)
const SAFE_3 = 0;

// ── Weight constants (mirrors backend/bin-status/src/types.ts) ────────────────
const KG_PER_LITRE = {
  food_waste: 0.90,
  paper:      0.10,
  glass:      2.50,
  plastic:    0.05,
  general:    0.30,
  e_waste:    3.20,
};

function calcUrgency(fill) {
  if (fill < 50) return { score: Math.round(fill * 0.60), status: 'normal'   };
  if (fill < 70) return { score: Math.round(fill * 0.90), status: 'monitor'  };
  if (fill < 85) return { score: Math.round(fill * 0.95), status: 'urgent'   };
  return           { score: Math.min(Math.round(fill * 1.02), 100), status: 'critical' };
}

function calcWeight(fill, volume, category) {
  return Math.round((fill / 100) * volume * KG_PER_LITRE[category] * 100) / 100;
}

// ── Bin state (mutable fill levels drift upward over time) ────────────────────
const BINS = [
  { bin_id: 'BIN-001', zone_id: 1, lat: 14.5995, lng: 120.9842, category: 'general',    volume: 240, fill: 82 },
  { bin_id: 'BIN-002', zone_id: 2, lat: 14.5921, lng: 120.9763, category: 'paper',      volume: 120, fill: 65 },
  { bin_id: 'BIN-003', zone_id: 1, lat: 14.6020, lng: 120.9900, category: 'food_waste', volume: 360, fill: 30 },
  { bin_id: 'BIN-004', zone_id: 3, lat: 14.6110, lng: 121.0050, category: 'general',    volume: 240, fill: 91 },
  { bin_id: 'BIN-005', zone_id: 4, lat: 14.5730, lng: 120.9650, category: 'e_waste',    volume: 660, fill: 48 },
  { bin_id: 'BIN-006', zone_id: 2, lat: 14.5880, lng: 120.9710, category: 'glass',      volume: 120, fill: 55 },
  { bin_id: 'BIN-007', zone_id: 1, lat: 14.6000, lng: 120.9780, category: 'general',    volume: 120, fill: 12 },
  { bin_id: 'BIN-009', zone_id: 1, lat: 14.5960, lng: 120.9870, category: 'food_waste', volume: 240, fill: 74 },
  { bin_id: 'BIN-010', zone_id: 3, lat: 14.6090, lng: 121.0020, category: 'plastic',    volume: 360, fill: 35 },
];

// ── Vehicle state ─────────────────────────────────────────────────────────────
// Each vehicle loops through zone waypoints; progress advances each 3s tick.
const VEHICLES = [
  {
    vehicle_id: 'LORRY-01', driver_id: 'DRV-001', wpIdx: 0, progress: 0,
    waypoints: [
      { lat: 14.5995, lng: 120.9842 },
      { lat: 14.6020, lng: 120.9900 },
      { lat: 14.6000, lng: 120.9780 },
      { lat: 14.5960, lng: 120.9870 },
    ],
  },
  {
    vehicle_id: 'LORRY-02', driver_id: 'DRV-002', wpIdx: 0, progress: 0,
    waypoints: [
      { lat: 14.5921, lng: 120.9763 },
      { lat: 14.5905, lng: 120.9737 },
      { lat: 14.5880, lng: 120.9710 },
      { lat: 14.5900, lng: 120.9745 },
    ],
  },
  {
    vehicle_id: 'LORRY-03', driver_id: 'DRV-003', wpIdx: 0, progress: 0,
    waypoints: [
      { lat: 14.6110, lng: 121.0050 },
      { lat: 14.6145, lng: 121.0085 },
      { lat: 14.6180, lng: 121.0100 },
      { lat: 14.6090, lng: 121.0020 },
    ],
  },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function bearing(from, to) {
  return (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180 / Math.PI + 360) % 360;
}

// Advance vehicle along its waypoint loop and return current {lat,lng,heading,speed}
function advanceVehicle(v) {
  const STEP = 0.12; // fraction of segment per 3s tick ≈ 35–50 km/h at these scales
  v.progress += STEP;
  if (v.progress >= 1) {
    v.progress = 0;
    v.wpIdx = (v.wpIdx + 1) % v.waypoints.length;
  }
  const from = v.waypoints[v.wpIdx];
  const to   = v.waypoints[(v.wpIdx + 1) % v.waypoints.length];
  return {
    lat:             parseFloat(lerp(from.lat, to.lat, v.progress).toFixed(6)),
    lng:             parseFloat(lerp(from.lng, to.lng, v.progress).toFixed(6)),
    heading_degrees: Math.round(bearing(from, to)),
    speed_kmh:       Math.round(25 + Math.random() * 25),
  };
}

// ── Zones for routine trigger ─────────────────────────────────────────────────
const ZONES = [
  { zone_id: 1, zone_name: 'Downtown Core',    bin_ids: ['BIN-001', 'BIN-003', 'BIN-007', 'BIN-009'] },
  { zone_id: 2, zone_name: 'Harbour District', bin_ids: ['BIN-002', 'BIN-006']                       },
  { zone_id: 3, zone_name: 'East Suburbs',     bin_ids: ['BIN-004', 'BIN-010']                       },
  { zone_id: 4, zone_name: 'Industrial South', bin_ids: ['BIN-005']                                  },
];

// ── Partition cycling ─────────────────────────────────────────────────────────
let binPart = 0;
let vehPart = 0;
const nextBinPart = () => SAFE_6[binPart++ % 3];
const nextVehPart = () => SAFE_6[vehPart++ % 3];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (lo, hi) => lo + Math.random() * (hi - lo);

function log(label, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${label}] ${msg}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const kafka = new Kafka({
    clientId: 'garabadge-simulator',
    brokers:  [BROKER],
    logLevel: logLevel.ERROR,
    ...(KAFKA_USER && KAFKA_PASS
      ? { sasl: { mechanism: 'scram-sha-256', username: KAFKA_USER, password: KAFKA_PASS } }
      : {}),
    retry: { retries: 3 },
  });

  const producer = kafka.producer({ allowAutoTopicCreation: false });

  log('init', `Connecting to ${BROKER} …`);
  await producer.connect();
  log('init', 'Connected.');

  // ── Startup: fire routine schedule trigger for every zone ─────────────────
  const today = new Date().toISOString().split('T')[0];
  const hhmm  = new Date().toTimeString().slice(0, 5);

  for (const zone of ZONES) {
    const msg = {
      version:        '1.0-sim',
      source_service: 'garabadge-simulator',
      timestamp:      new Date().toISOString(),
      payload: {
        schedule_id:      `SCH-SIM-${zone.zone_id}-${Date.now()}`,
        zone_id:          zone.zone_id,
        zone_name:        zone.zone_name,
        waste_category_id: null,
        scheduled_date:   today,
        scheduled_time:   hhmm,
        bin_ids:          zone.bin_ids,
        route_plan_id:    `RP-SIM-${zone.zone_id}`,
      },
    };
    await producer.send({
      topic:    'waste.routine.schedule.trigger',
      messages: [{ partition: SAFE_3, value: JSON.stringify(msg) }],
    });
    log('routine', `Zone ${zone.zone_id} (${zone.zone_name}) → ${zone.bin_ids.length} bins`);
    await sleep(400);
  }

  // ── Periodic: bin fill levels → waste.bin.processed (every 5s) ───────────
  setInterval(async () => {
    for (const bin of BINS) {
      // Fill drifts up 0.3–0.8% per tick; reset to 5–15% once collected at 95%+
      bin.fill = parseFloat((bin.fill + rand(0.3, 0.8)).toFixed(2));
      if (bin.fill > 95) bin.fill = Math.round(rand(5, 15));

      const { score, status } = calcUrgency(bin.fill);
      const weight = calcWeight(bin.fill, bin.volume, bin.category);

      const envelope = {
        version:        '1.0-sim',
        source_service: 'garabadge-simulator',
        timestamp:      new Date().toISOString(),
        payload: {
          bin_id:              bin.bin_id,
          cluster_id:          bin.bin_id,            // one bin per cluster in sim
          fill_level_pct:      bin.fill,
          urgency_score:       score,
          urgency_status:      status,
          estimated_weight_kg: weight,
          waste_category:      bin.category,
          volume_litres:       bin.volume,
          zone_id:             bin.zone_id,           // numeric; orchestrator uses Number()
          latitude:            bin.lat,
          longitude:           bin.lng,
          battery_pct:         Math.round(rand(20, 99)),
        },
      };

      try {
        await producer.send({
          topic:    'waste.bin.processed',
          messages: [{ partition: nextBinPart(), value: JSON.stringify(envelope) }],
        });
      } catch (e) {
        log('ERROR', `bin.processed ${bin.bin_id}: ${e.message}`);
      }
    }

    const fills = BINS.map(b => b.fill);
    log('bins', `Batch sent — fill range ${Math.min(...fills).toFixed(1)}–${Math.max(...fills).toFixed(1)}%`);
  }, 5_000);

  // ── Periodic: vehicle GPS → waste.vehicle.location (every 3s) ────────────
  setInterval(async () => {
    for (const v of VEHICLES) {
      const pos = advanceVehicle(v);
      const envelope = {
        version:        '1.0-sim',
        source_service: 'garabadge-simulator',
        timestamp:      new Date().toISOString(),
        payload: {
          vehicle_id:      v.vehicle_id,
          driver_id:       v.driver_id,
          lat:             pos.lat,
          lng:             pos.lng,
          speed_kmh:       pos.speed_kmh,
          heading_degrees: pos.heading_degrees,
          accuracy_m:      Math.round(rand(3, 8)),
        },
      };
      try {
        await producer.send({
          topic:    'waste.vehicle.location',
          messages: [{ partition: nextVehPart(), value: JSON.stringify(envelope) }],
        });
      } catch (e) {
        log('ERROR', `vehicle.location ${v.vehicle_id}: ${e.message}`);
      }
    }
  }, 3_000);

  // ── Occasional: route deviation → waste.vehicle.deviation (every ~45s) ────
  // The scheduler drops this event if the vehicle has no active job assigned —
  // that's expected until the orchestrator dispatches a job to the scheduler.
  let devIdx = 0;
  setInterval(async () => {
    const v   = VEHICLES[devIdx++ % VEHICLES.length];
    const pos = advanceVehicle(v);
    const dev = Math.round(rand(150, 650));
    const dur = Math.round(rand(30, 180));

    const envelope = {
      payload: {
        vehicle_id:       v.vehicle_id,
        job_id:           `JOB-SIM-${v.vehicle_id}`,
        deviation_metres: dev,
        duration_seconds: dur,
        current_lat:      pos.lat,
        current_lng:      pos.lng,
      },
    };
    try {
      await producer.send({
        topic:    'waste.vehicle.deviation',
        messages: [{ partition: SAFE_3, value: JSON.stringify(envelope) }],
      });
      log('deviation', `${v.vehicle_id} — ${dev}m off route for ${dur}s`);
    } catch (e) {
      log('ERROR', `vehicle.deviation ${v.vehicle_id}: ${e.message}`);
    }
  }, 45_000);

  log('init', 'Simulator running. Ctrl-C to stop.');
  log('init', `  waste.bin.processed      — every 5s  (partitions ${SAFE_6})`);
  log('init', `  waste.vehicle.location   — every 3s  (partitions ${SAFE_6})`);
  log('init', `  waste.vehicle.deviation  — every 45s (partition  ${SAFE_3})`);
  log('init', `  waste.routine.schedule.trigger — fired once per zone on startup`);
}

main().catch(e => {
  console.error('[sim] Fatal:', e.message);
  process.exit(1);
});
