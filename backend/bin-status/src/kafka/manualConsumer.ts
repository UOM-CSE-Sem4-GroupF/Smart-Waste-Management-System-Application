import { Kafka, logLevel } from 'kafkajs';

export type MessageHandler = (
  value: Buffer,
  partition: number,
  offset: string,
) => Promise<void>;

export function buildKafka(clientId: string): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
    // Fix: Expand short hostnames for cross-namespace resolution (Admin/Seed connection)
    socketFactory: (options: any) => {
      const { host, port } = options;
      const fqdnHost = (host.includes('.') || host === 'localhost') 
        ? host 
        : `${host}.messaging.svc.cluster.local`;
      
      process.stdout.write(JSON.stringify({ 
        level: 'DEBUG', 
        message: `Kafka connection attempt: ${host}:${port} -> ${fqdnHost}:${port}` 
      }) + '\n');

      return require('kafkajs/src/network/socketFactory')()({ ...options, host: fqdnHost });
    },
    ...(user && pass
      ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } }
      : {}),
  });
}

export async function startManualConsumer(
  clientId: string,
  topic: string,
  onMessage: MessageHandler,
  log: (level: string, msg: string) => void,
): Promise<() => void> {
  const kafka = buildKafka(clientId);

  // ── 1. Partition layout + latest offsets (public admin API, no group coordinator) ──
  const admin = kafka.admin();
  await admin.connect();

  const [topicMeta, topicOffsets] = await Promise.all([
    admin.fetchTopicMetadata({ topics: [topic] }),
    admin.fetchTopicOffsets(topic),
  ]);

  await admin.disconnect();

  const partitions: Array<{ partitionId: number; leader: number }> =
    (topicMeta.topics[0]?.partitions ?? []).map((p: any) => ({
      partitionId: p.partitionId,
      leader:      p.leader,
    }));

  if (!partitions.length) {
    log('WARN', `${clientId}: no partitions found for ${topic} — not starting`);
    return () => {};
  }

  const offsets = new Map<number, string>(
    topicOffsets.map(({ partition, offset }: { partition: number; offset: string }) =>
      [partition, offset],
    ),
  );

  // ── 2. Raw cluster via kafkajs internal factory ──────────────────────────────────
  // We use the internal Cluster class to bypass the group coordinator entirely.
  const ClusterClass: any = require('kafkajs/src/cluster');
  
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;

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
      
      process.stdout.write(JSON.stringify({ 
        level: 'DEBUG', 
        message: `Kafka Cluster connection attempt: ${host}:${port} -> ${fqdnHost}:${port}` 
      }) + '\n');

      return require('kafkajs/src/network/socketFactory')()({ ...options, host: fqdnHost });
    },
    connectionTimeout: 10000,
    authenticationTimeout: 10000,
    requestTimeout: 30000,
    retry: { retries: 5, multiplier: 2, maxRetryTime: 30000, initialRetryTime: 300 },
  });

  await cluster.connect();
  log('INFO', `${clientId}: connected — ${partitions.length} partition(s) on ${topic}, starting from latest (Group-Free)`);

  let running = true;

  const poll = async () => {
    while (running) {
      for (const { partitionId, leader } of partitions) {
        if (!running) break;
        try {
          let broker;
          try {
            broker = await cluster.findBroker({ nodeId: leader });
          } catch (err: any) {
            // Fallback: If the DigitalOcean load balancer rewrote the broker list to only contain Node 0,
            // we'll get a KafkaJSBrokerNotFound for the actual leader. We just route to the LB.
            const pool = (cluster as any).brokerPool?.brokers || {};
            const availableNodes = Object.keys(pool);
            if (availableNodes.length > 0) {
              broker = pool[availableNodes[0]];
            } else {
              throw err;
            }
          }

          const fetchResp = await broker.fetch({
            replicaId:   -1,
            maxWaitTime: 500,
            minBytes:    1,
            maxBytes:    1_048_576,
            topics: [{
              topic,
              partitions: [{
                partition:   partitionId,
                fetchOffset: offsets.get(partitionId) ?? '0',
                maxBytes:    1_048_576,
              }],
            }],
          });

          const messages: any[] =
            fetchResp?.responses?.[0]?.partitions?.[0]?.messages ?? [];

          for (const msg of messages) {
            if (!msg.value) continue;
            await onMessage(msg.value as Buffer, partitionId, String(msg.offset));
            offsets.set(partitionId, String(BigInt(msg.offset) + 1n));
          }
        } catch (err: any) {
          if (!running) break;
          log('WARN', `${clientId} fetch ${topic}[${partitionId}]: ${err?.message ?? String(err)}`);
          if (err?.type === 'LEADER_NOT_AVAILABLE' || err?.type === 'NOT_LEADER_FOR_PARTITION') {
            await cluster.refreshMetadata().catch(() => {});
          }
          await new Promise(r => setTimeout(r, 1_000));
        }
      }
      if (running) await new Promise(r => setTimeout(r, 100));
    }

    await cluster.disconnect().catch(() => {});
    log('INFO', `${clientId} stopped`);
  };

  poll().catch(e => log('ERROR', `${clientId} poll crashed: ${e?.message ?? String(e)}`));

  return () => { running = false; };
}
