import { Kafka, logLevel } from 'kafkajs';
import { vehicles } from '../store';

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

export async function startKafkaConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'scheduler-service' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.vehicle.location', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const p        = envelope.payload ?? envelope;
        const vid      = String(p.vehicle_id ?? p.vehicleId ?? '');
        if (!vid) return;

        const vehicle = vehicles.get(vid);
        if (vehicle) {
          vehicle.lat         = Number(p.latitude  ?? p.lat      ?? vehicle.lat);
          vehicle.lng         = Number(p.longitude ?? p.lng      ?? vehicle.lng);
          vehicle.heading     = Number(p.heading   ?? vehicle.heading);
          vehicle.speed_kmh   = Number(p.speed_kmh ?? p.speed    ?? vehicle.speed_kmh);
          vehicle.last_update = String(envelope.timestamp ?? new Date().toISOString());
        }
      } catch (e) {
        slog('ERROR', `vehicle.location handler error: ${e}`);
      }
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to waste.vehicle.location');
}
