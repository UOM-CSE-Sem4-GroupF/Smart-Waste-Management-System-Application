import 'dotenv/config';
import { Kafka, logLevel } from 'kafkajs';

// waste.bin.telemetry — partition 0, leader broker 100 (NLB, externally reachable)
// Consumer groups are blocked (GroupCoordinator on broker 0, internal-only).
// We bypass group coordination entirely: connect directly to broker 100 and fetch.

const TOPIC     = 'waste.bin.telemetry';
const PARTITION = 0;
const BROKER_ID = 100;


function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'bin-status-test',
    brokers,
    logLevel:          logLevel.ERROR,
    connectionTimeout: 10_000,
    requestTimeout:    30_000,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

async function run() {
  const kafka = buildKafka();

  const createClusterSym = Object.getOwnPropertySymbols(kafka)
    .find(s => s.toString() === 'Symbol(private:Kafka:createCluster)')!;
  const cluster = (kafka as any)[createClusterSym]({ allowAutoTopicCreation: false });

  await cluster.connect();
  await cluster.refreshMetadata();

  const broker = await cluster.findBroker({ nodeId: String(BROKER_ID) });

  // Start from current high-watermark (tail) so we only see live messages
  const { responses: offsetResponses } = await broker.listOffsets({
    replicaId: -1,
    isolationLevel: 1,
    topics: [{ topic: TOPIC, partitions: [{ partition: PARTITION, timestamp: '-1' }] }],
  });
  let nextOffset = parseInt(offsetResponses[0].partitions[0].offset, 10);

  console.log(`[${TOPIC}] live feed from offset ${nextOffset} — Ctrl+C to stop\n`);

  // Continuous poll loop
  while (true) {
    const { responses } = await broker.fetch({
      replicaId:      -1,
      isolationLevel: 1,
      maxWaitTime:    1_000,  // broker holds connection open up to 1s if no new data
      minBytes:       1,
      maxBytes:       10_485_760,
      topics: [{
        topic: TOPIC,
        partitions: [{ partition: PARTITION, fetchOffset: String(nextOffset), maxBytes: 10_485_760 }],
      }],
    });

    const messages = responses[0]?.partitions[0]?.messages ?? [];
    for (const msg of messages) {
      if (msg.value) {
        console.log(msg.value.toString());
        nextOffset = parseInt(msg.offset, 10) + 1;
      }
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
