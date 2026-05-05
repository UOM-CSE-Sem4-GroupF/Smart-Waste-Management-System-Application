import { Kafka, logLevel, Producer } from 'kafkajs';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg }) + '\n');

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-producer',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } } : {}),
  });
}

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = buildKafka().producer();
    await producer.connect();
  }
  return producer;
}

export async function publishJobCompleted(payload: Record<string, unknown>): Promise<void> {
  try {
    const p = await getProducer();
    await p.send({
      topic:    'waste.job.completed',
      messages: [{ value: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }) }],
    });
  } catch (e) {
    slog('WARN', `Failed to publish waste.job.completed: ${(e as Error).message}`);
  }
}
