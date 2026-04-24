import { Kafka, logLevel } from 'kafkajs';
import { emitToRoom, emitToAll } from '../socket';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');

const TOPICS = [
  'waste.bin.processed',
  'waste.bin.status.changed',
  'waste.vehicle.location',
  'waste.vehicle.deviation',
  'waste.zone.statistics',
  'waste.job.completed',
];

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;

  return new Kafka({
    clientId: 'notification-service',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

function handle(topic: string, payload: Record<string, unknown>, timestamp: string): void {
  switch (topic) {
    case 'waste.bin.processed': {
      const urgency_score = Number(payload.urgency_score ?? 0);
      if (urgency_score >= 80) {
        emitToRoom('dashboard-all', 'alert:urgent', {
          bin_id:         payload.bin_id,
          urgency_score,
          urgency_status: payload.urgency_status,
          fill_level_pct: payload.fill_level_pct,
          zone_id:        payload.zone_id,
          timestamp,
        });
      }
      emitToRoom('dashboard-all', 'bin:update', { ...payload, timestamp });
      break;
    }

    case 'waste.bin.status.changed': {
      emitToAll('bin:update', { ...payload, timestamp });
      break;
    }

    case 'waste.vehicle.location': {
      const data = { ...payload, timestamp };
      emitToRoom('fleet-ops',      'vehicle:position', data);
      emitToRoom('dashboard-all',  'vehicle:position', data);
      const driver_id = payload.driver_id ?? payload.driverId;
      if (driver_id) emitToRoom(`driver-${driver_id}`, 'vehicle:position', data);
      break;
    }

    case 'waste.vehicle.deviation': {
      emitToRoom('fleet-ops', 'alert:deviation', { ...payload, timestamp });
      break;
    }

    case 'waste.zone.statistics': {
      const zone_id = payload.zone_id ?? payload.zone;
      if (zone_id) emitToRoom(`dashboard-zone-${zone_id}`, 'zone:stats', { ...payload, timestamp });
      emitToRoom('dashboard-all', 'zone:stats', { ...payload, timestamp });
      break;
    }

    case 'waste.job.completed': {
      emitToRoom('dashboard-all', 'job:status', { ...payload, status: 'COMPLETED', timestamp });
      const driver_id = payload.driver_id;
      if (driver_id) emitToRoom(`driver-${driver_id}`, 'job:status', { ...payload, status: 'COMPLETED', timestamp });
      break;
    }
  }
}

export async function startKafkaConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'notification-service' });

  await consumer.connect();
  await consumer.subscribe({ topics: TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const payload  = (envelope.payload ?? envelope) as Record<string, unknown>;
        handle(topic, payload, String(envelope.timestamp ?? new Date().toISOString()));
      } catch (e) {
        slog('ERROR', `Handler error on ${topic}: ${e}`);
      }
    },
  });

  slog('INFO', `Kafka consumer ready — subscribed to ${TOPICS.length} topics`);
}
