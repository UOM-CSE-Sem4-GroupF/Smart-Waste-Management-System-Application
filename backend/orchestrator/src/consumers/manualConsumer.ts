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
    ...(user && pass
      ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } }
      : {}),
  });
}

// Group-free consumer — equivalent to Python kafka-python group_id=None + assign() + seek_to_end().
//
// kafkajs v2 has no public kafka.cluster() method.  The internal factory lives at
// kafkajs/src/cluster and the merged config is stored on kafka.options.
// We use those two together to create a raw Cluster, then call cluster.findBroker()
// + broker.fetch() directly — the KRaft group coordinator is never contacted.
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

  // Start from log-end so we do not replay existing messages.
  // Stored as strings to avoid BigInt encoding surprises in broker.fetch().
  const offsets = new Map<number, string>(
    topicOffsets.map(({ partition, offset }: { partition: number; offset: string }) =>
      [partition, offset],
    ),
  );

  // ── 2. Raw cluster via kafkajs internal factory ──────────────────────────────────
  // kafkajs/src/cluster exports the same createCluster() called by kafka.admin/consumer/producer.
  // kafka.options holds the merged config (brokers, sasl, logCreator, retry, …).
  const createCluster: (opts: unknown) => any = require('kafkajs/src/cluster');
  const clusterOpts: any = (kafka as any).options ?? {
    brokers: (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(','),
    clientId,
    sasl: process.env.KAFKA_USER && process.env.KAFKA_PASS
      ? { mechanism: 'scram-sha-256', username: process.env.KAFKA_USER, password: process.env.KAFKA_PASS }
      : undefined,
    logLevel: logLevel.ERROR,
    logCreator: () => () => {},
  };

  const cluster = createCluster(clusterOpts);
  await cluster.connect();

  log('INFO', `${clientId}: connected — ${partitions.length} partition(s) on ${topic}, starting from latest`);

  let running = true;

  const poll = async () => {
    while (running) {
      for (const { partitionId, leader } of partitions) {
        if (!running) break;
        try {
          const broker    = await cluster.findBroker({ nodeId: leader });
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

  poll().catch(e => log('ERROR', `${clientId} poll crashed: ${e?.message}`));

  return () => { running = false; };
}
