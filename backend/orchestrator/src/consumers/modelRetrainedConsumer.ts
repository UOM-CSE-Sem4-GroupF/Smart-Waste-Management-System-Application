import { Kafka, logLevel } from 'kafkajs';

const slog = (level: string, msg: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg,
  }) + '\n');
};

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-model-consumer',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function startModelRetrainedConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator-model' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.model.retrained', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      slog('INFO', 'Model retrained event received — no action taken by orchestrator');
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to waste.model.retrained');
}
