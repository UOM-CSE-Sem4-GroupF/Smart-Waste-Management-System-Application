import { Kafka, logLevel } from 'kafkajs';
import { BinProcessedPayload, WasteCategory } from '../types';
import { upsertBin, computeWeight } from '../store';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'bin-status', message: msg }) + '\n');

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;

  return new Kafka({
    clientId:  'bin-status-service',
    brokers,
    logLevel:  logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function startKafkaConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'bin-status-service' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.bin.processed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const p        = (envelope.payload ?? envelope) as BinProcessedPayload;

        const waste_category = (p.waste_category ?? 'general') as WasteCategory;
        const volume_litres  = p.volume_litres ?? 240;
        const estimated_weight_kg = p.estimated_weight_kg
          ?? computeWeight(p.fill_level_pct, volume_litres, waste_category);

        upsertBin({
          bin_id:              p.bin_id,
          fill_level_pct:      p.fill_level_pct,
          urgency_score:       p.urgency_score,
          urgency_status:      p.urgency_status ?? 'normal',
          estimated_weight_kg,
          waste_category,
          volume_litres,
          zone_id:             p.zone_id   ?? 'unknown',
          lat:                 p.latitude  ?? 0,
          lng:                 p.longitude ?? 0,
          last_reading_at:     envelope.timestamp ?? new Date().toISOString(),
        });
      } catch (e) {
        slog('ERROR', `Failed to process waste.bin.processed: ${e}`);
      }
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to waste.bin.processed');
}
