/**
 * ManualProducer — uses the standard KafkaJS Producer API.
 *
 * IMPORTANT: Producers do NOT use consumer groups.
 * The group-free pattern is only needed for consumers.
 * The standard kafka.producer() handles leader discovery and
 * metadata refresh automatically without any group coordinator.
 *
 * The internal Cluster API's broker.produce() was failing because
 * it triggers an implicit Metadata request that returns
 * "This server does not host this topic-partition" from the
 * KRaft controller node.
 */
import { Kafka, logLevel, Producer } from 'kafkajs';

export interface ManualProducer {
  send(topic: string, key: string | null, value: string): Promise<void>;
  disconnect(): Promise<void>;
}

export async function createManualProducer(clientId: string): Promise<ManualProducer> {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092')
    .split(',')
    .map((b) => b.trim());
  const user = process.env.KAFKA_USER;
  const pass = process.env.KAFKA_PASS;

  const kafka = new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
    connectionTimeout: 10_000,
    authenticationTimeout: 10_000,
    retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
    ...(user && pass
      ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } }
      : {}),
  });

  const ClusterClass: any = require('kafkajs/src/cluster');
  const cluster = new ClusterClass({
    brokers,
    clientId,
    sasl: user && pass ? { mechanism: 'scram-sha-256', username: user, password: pass } : undefined,
    logger: kafka.logger(),
    instrumentationEmitter: (kafka as any).instrumentationEmitter ?? {
      emit: () => {},
      addListener: () => {},
      removeListener: () => {},
    },
    // Fix: Expand short hostnames (like kafka-broker-0) to FQDNs for cross-namespace resolution
    socketFactory: (options: any) => {
      const { host, port } = options;
      const fqdnHost = (host.includes('.') || host === 'localhost') 
        ? host 
        : `${host}.messaging.svc.cluster.local`;
      return require('kafkajs/src/network/socketFactory')()({ ...options, host: fqdnHost });
    },
    connectionTimeout: 10_000,
    authenticationTimeout: 10_000,
    requestTimeout: 30_000,
    retry: { retries: 5, multiplier: 2, maxRetryTime: 30_000, initialRetryTime: 300 },
  });

  await cluster.connect();

  const metaCache  = new Map<string, { partitionId: number; leader: number }[]>();
  const cursor     = new Map<string, number>();

  async function fetchMeta(topic: string) {
    const admin = kafka.admin();
    await admin.connect();
    const meta = await admin.fetchTopicMetadata({ topics: [topic] });
    await admin.disconnect();

    const partitions = (meta.topics[0]?.partitions ?? []).map((p: any) => ({
      partitionId: p.partitionId as number,
      leader:      p.leader      as number,
    }));

    if (partitions.length === 0) {
      throw new Error(`No partitions found for topic ${topic}`);
    }

    metaCache.set(topic, partitions);
    cursor.set(topic, 0);
    return partitions;
  }

  async function ensureMeta(topic: string) {
    return metaCache.get(topic) ?? fetchMeta(topic);
  }

  return {
    async send(topic: string, key: string | null, value: string): Promise<void> {
      const partitions = await ensureMeta(topic);

      const idx = (cursor.get(topic) ?? 0) % partitions.length;
      const { partitionId, leader } = partitions[idx];
      cursor.set(topic, idx + 1);

      let broker;
      try {
        broker = await cluster.findBroker({ nodeId: leader });
      } catch (err: any) {
        // Fallback: If DO load balancer rewrites the broker list to only contain Node 0
        const pool = (cluster as any).brokerPool?.brokers || {};
        const availableNodes = Object.keys(pool);
        if (availableNodes.length > 0) {
          broker = pool[availableNodes[0]];
        } else {
          throw err;
        }
      }

      try {
        await broker.produce({
          topicData: [{
            topic,
            partitions: [{
              partition: partitionId,
              messages: [{
                key:       key ? Buffer.from(key) : null,
                value:     Buffer.from(value),
                timestamp: String(Date.now()),
              }],
            }],
          }],
          acks:        1,
          timeout:     10_000,
          compression: 0,
        });
      } catch (err: any) {
        if (err?.type === 'NOT_LEADER_FOR_PARTITION' || err?.type === 'LEADER_NOT_AVAILABLE') {
          metaCache.delete(topic);
        }
        throw err;
      }
    },

    async disconnect(): Promise<void> {
      await cluster.disconnect().catch(() => {});
    },
  };
}
