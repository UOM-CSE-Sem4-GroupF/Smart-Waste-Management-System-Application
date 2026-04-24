import { spawn } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';
import {
  upsertBin, setBinStatus, addAlert,
  upsertRoute, setRouteStatus,
  upsertZone, upsertVehicle,
  type BinStatus, type AlertSev, type WasteType, type RouteStatus,
} from '../data/store';

const BRIDGE = path.join(__dirname, 'bridge.py');

type Log = { info: (s: string) => void; warn: (s: string) => void; error: (s: string) => void };

export function startKafkaConsumer(log: Log): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [BRIDGE], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: proc.stdout! });

    rl.on('line', (line) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(line); } catch { return; }

      if (msg.status === 'ready') {
        log.info('Kafka bridge ready — consuming 7 topics via direct partition assignment');
        resolve();
        return;
      }
      if (msg.status === 'error') {
        log.error(`Kafka bridge error: ${msg.error}`);
        reject(new Error(String(msg.error)));
        return;
      }

      const topic   = String(msg.topic ?? '');
      const payload = msg.payload as Record<string, unknown>;
      if (!topic || !payload) return;

      try {
        handle(topic, payload, log);
      } catch (e) {
        log.error(`Kafka handler error on ${topic}: ${e}`);
      }
    });

    proc.stderr!.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line) log.warn(`Kafka bridge: ${line}`);
    });

    proc.on('close', (code) => {
      log.warn(`Kafka bridge exited (code ${code}) — restarting in 5 s`);
      setTimeout(() => startKafkaConsumer(log).catch(() => {}), 5000);
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ── Topic handlers ───────────────────────────────────────────────────────────

function handle(
  topic: string,
  msg: Record<string, unknown>,
  log: { info: (s: string) => void; warn: (s: string) => void },
) {
  switch (topic) {

    case 'waste.bin.telemetry': {
      // Envelope: { version, source_service, timestamp, payload: { bin_id, fill_level_pct, battery_level_pct, ... } }
      const inner = (msg.payload ?? msg) as Record<string, unknown>;
      const id = str(inner.bin_id ?? msg.bin_id);
      if (!id) { log.warn('telemetry: missing bin_id'); return; }
      upsertBin({
        id,
        fill:     num(inner.fill_level_pct),
        battery:  num(inner.battery_level_pct ?? inner.battery_pct ?? inner.battery),
        lat:      num(inner.latitude  ?? inner.lat),
        lng:      num(inner.longitude ?? inner.lng),
        type:     (str(inner.waste_type) as WasteType) || undefined,
        offline:  false,
        lastPing: inner.timestamp ? new Date(str(inner.timestamp)).getTime() : (msg.timestamp ? num(msg.timestamp) : Date.now()),
      });
      break;
    }

    case 'waste.bin.processed': {
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
      const id     = str(msg.bin_id);
      const status = str(msg.new_status) as BinStatus;
      if (!id || !status) return;
      setBinStatus(id, status);
      const sev: AlertSev = status === 'critical' ? 'critical'
                          : status === 'warning'  ? 'warning'
                          : 'info';
      addAlert(sev, id, str(msg.reason) || `Status changed to ${status}`,
               msg.timestamp ? num(msg.timestamp) * 1000 : undefined);
      break;
    }

    case 'waste.collection.jobs': {
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
      const id = str(msg.route_id ?? msg.job_id);
      if (!id) return;
      setRouteStatus(id, 'complete');
      break;
    }

    case 'waste.zone.statistics': {
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

    case 'waste.vehicle.location': {
      // { vehicle_id, latitude, longitude, heading, speed_kmh, route_id, timestamp }
      const id = str(msg.vehicle_id ?? msg.vehicleId);
      if (!id) return;
      upsertVehicle({
        id,
        lat:        num(msg.latitude  ?? msg.lat),
        lng:        num(msg.longitude ?? msg.lng),
        heading:    num(msg.heading),
        speed:      num(msg.speed_kmh ?? msg.speed),
        routeId:    str(msg.route_id  ?? msg.routeId) || undefined,
        lastUpdate: msg.timestamp ? num(msg.timestamp) * 1000 : Date.now(),
      });
      break;
    }
  }
}

function num(v: unknown): number { return typeof v === 'number' ? v : Number(v ?? 0); }
function str(v: unknown): string { return typeof v === 'string' ? v : String(v ?? ''); }
