import { Kafka, logLevel, PartitionAssigners } from 'kafkajs';
import {
  upsertBin, setBinStatus, addAlert,
  upsertRoute, setRouteStatus,
  upsertZone,
  type BinStatus, type AlertSev, type WasteType, type RouteStatus,
} from '../data/store';

const BROKER = process.env.KAFKA_BROKER ?? 'localhost:9092';
const USER   = process.env.KAFKA_USER;
const PASS   = process.env.KAFKA_PASS;

const TOPICS = [
  'waste.bin.telemetry',
  'waste.bin.processed',
  'waste.bin.status.changed',
  'waste.collection.jobs',
  'waste.routes.optimized',
  'waste.job.completed',
  'waste.zone.statistics',
];

function makeSasl() {
  if (!USER || !PASS) return undefined;
  return { mechanism: 'scram-sha-256' as const, username: USER, password: PASS };
}

export async function startKafkaConsumer(log: { info: (s: string) => void; warn: (s: string) => void; error: (s: string) => void }) {
  const sasl = makeSasl();
  const kafka = new Kafka({
    clientId: 'garabadge-backend',
    brokers: [BROKER],
    ssl: false,
    sasl,
    logLevel: logLevel.WARN,
    retry: { retries: 5, initialRetryTime: 2000 },
  });

  const consumer = kafka.consumer({
    groupId: 'garabadge-backend-group',
    partitionAssigners: [PartitionAssigners.roundRobin],
  });

  await consumer.connect();
  log.info(`Kafka connected to ${BROKER}`);

  await consumer.subscribe({ topics: TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        log.warn(`Kafka: unparseable message on ${topic}`);
        return;
      }
      try {
        handle(topic, payload, log);
      } catch (e) {
        log.error(`Kafka handler error on ${topic}: ${e}`);
      }
    },
  });

  return consumer;
}

// ── Topic handlers ───────────────────────────────────────────────────────────

function handle(
  topic: string,
  msg: Record<string, unknown>,
  log: { info: (s: string) => void; warn: (s: string) => void },
) {
  switch (topic) {

    case 'waste.bin.telemetry': {
      // Envelope: { bin_id, payload: { bin_id, fill_level_pct, battery_pct, latitude, longitude, waste_type, timestamp } }
      const inner = (msg.payload ?? msg) as Record<string, unknown>;
      const id = str(inner.bin_id ?? msg.bin_id);
      if (!id) { log.warn('telemetry: missing bin_id'); return; }
      upsertBin({
        id,
        fill:     num(inner.fill_level_pct),
        battery:  num(inner.battery_pct ?? inner.battery),
        lat:      num(inner.latitude  ?? inner.lat),
        lng:      num(inner.longitude ?? inner.lng),
        type:     (str(inner.waste_type) as WasteType) || undefined,
        offline:  false,
        lastPing: inner.timestamp ? num(inner.timestamp) * 1000 : Date.now(),
      });
      break;
    }

    case 'waste.bin.processed': {
      // Flink-processed telemetry — same shape, richer fields
      const id = str(msg.bin_id);
      if (!id) return;
      upsertBin({
        id,
        fill:    num(msg.fill_level_pct ?? msg.fill),
        battery: num(msg.battery_pct   ?? msg.battery),
        lat:     num(msg.latitude ?? msg.lat),
        lng:     num(msg.longitude ?? msg.lng),
        zone:    str(msg.zone_id ?? msg.zone) || undefined,
        lastPing: Date.now(),
      });
      break;
    }

    case 'waste.bin.status.changed': {
      // { bin_id, old_status, new_status, reason, timestamp }
      const id     = str(msg.bin_id);
      const status = str(msg.new_status) as BinStatus;
      if (!id || !status) return;
      setBinStatus(id, status);
      const sev: AlertSev = status === 'critical' ? 'critical'
                          : status === 'warning'  ? 'warning'
                          : 'info';
      const reason = str(msg.reason) || `Status changed to ${status}`;
      addAlert(sev, id, reason, msg.timestamp ? num(msg.timestamp) * 1000 : undefined);
      break;
    }

    case 'waste.collection.jobs': {
      // { job_id, route_id?, label?, driver, vehicle, stops:[{bin_id,order,eta}], distance_km, duration_min, status }
      const id = str(msg.route_id ?? msg.job_id);
      if (!id) return;
      const rawStops = (msg.stops as Array<Record<string, unknown>> | undefined) ?? [];
      upsertRoute({
        id,
        label:       str(msg.label) || id,
        driver:      str(msg.driver),
        vehicle:     str(msg.vehicle),
        distanceKm:  num(msg.distance_km ?? msg.distanceKm),
        durationMin: num(msg.duration_min ?? msg.durationMin),
        status:      (str(msg.status) as RouteStatus) || 'pending',
        stops: rawStops.map(s => ({
          binId: str(s.bin_id ?? s.binId),
          order: num(s.order),
          eta:   str(s.eta),
        })),
      });
      break;
    }

    case 'waste.routes.optimized': {
      // { route_id, stops:[{bin_id,order,eta}], distance_km, duration_min }
      const id = str(msg.route_id);
      if (!id) return;
      const rawStops = (msg.stops as Array<Record<string, unknown>> | undefined) ?? [];
      upsertRoute({
        id,
        distanceKm:  num(msg.distance_km ?? msg.distanceKm),
        durationMin: num(msg.duration_min ?? msg.durationMin),
        stops: rawStops.map(s => ({
          binId: str(s.bin_id ?? s.binId),
          order: num(s.order),
          eta:   str(s.eta),
        })),
      });
      break;
    }

    case 'waste.job.completed': {
      // { job_id, route_id?, completed_at }
      const id = str(msg.route_id ?? msg.job_id);
      if (!id) return;
      setRouteStatus(id, 'complete');
      break;
    }

    case 'waste.zone.statistics': {
      // { zone_id, bin_count, avg_fill_pct, active_alerts, ... }
      const id = str(msg.zone_id ?? msg.zone);
      if (!id) return;
      upsertZone({
        id,
        name:     str(msg.zone_name ?? msg.name) || undefined,
        binCount: num(msg.bin_count ?? msg.binCount),
        avgFill:  num(msg.avg_fill_pct ?? msg.avgFill),
      });
      break;
    }
  }
}

// ── Tiny coercers ────────────────────────────────────────────────────────────

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v ?? 0); }
function str(v: unknown): string { return typeof v === 'string' ? v : String(v ?? ''); }
