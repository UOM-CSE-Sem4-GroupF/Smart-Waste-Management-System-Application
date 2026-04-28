import { Kafka, logLevel } from 'kafkajs';
import { emitToRooms } from '../socket';
import { DashboardUpdateEvent, VehicleUpdateEvent } from '../types';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');

function buildKafka(): Kafka {
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

export function handleBinEvent(data: DashboardUpdateEvent): void {
  const { event_type, payload } = data;

  switch (event_type) {
    case 'bin:update':
      emitToRooms([`dashboard-zone-${payload.zone_id}`, 'dashboard-all'], 'bin:update', payload);
      break;

    case 'zone:stats':
      emitToRooms([`dashboard-zone-${payload.zone_id}`, 'dashboard-all'], 'zone:stats', payload);
      break;

    case 'alert:urgent':
      emitToRooms([`dashboard-zone-${payload.zone_id}`, 'dashboard-all', 'alerts-all'], 'alert:urgent', payload);
      break;
  }
}

export function handleVehicleEvent(data: VehicleUpdateEvent): void {
  const { event_type, payload } = data;

  switch (event_type) {
    case 'vehicle:position':
      emitToRooms([`dashboard-zone-${payload.zone_id}`, 'dashboard-all', 'fleet-ops'], 'vehicle:position', payload);
      break;

    case 'job:progress':
      emitToRooms([`dashboard-zone-${payload.zone_id}`, 'dashboard-all'], 'job:progress', payload);
      break;
  }
}

async function makeConsumer(
  kafka: Kafka,
  groupId: string,
  topic: string,
  handler: (data: Record<string, unknown>) => void,
): Promise<void> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topics: [topic], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const data = JSON.parse(message.value.toString()) as Record<string, unknown>;
        handler(data);
      } catch (e) {
        slog('ERROR', `Handler error on ${topic}: ${e}`);
      }
    },
  });

  slog('INFO', `Kafka consumer ready — group=${groupId} topic=${topic}`);
}

export async function startKafkaConsumers(): Promise<void> {
  const kafka = buildKafka();

  await Promise.all([
    makeConsumer(kafka, 'notification-bin-updates',     'waste.bin.dashboard.updates',     (d) => handleBinEvent(d as unknown as DashboardUpdateEvent)),
    makeConsumer(kafka, 'notification-vehicle-updates', 'waste.vehicle.dashboard.updates', (d) => handleVehicleEvent(d as unknown as VehicleUpdateEvent)),
  ]);
}
