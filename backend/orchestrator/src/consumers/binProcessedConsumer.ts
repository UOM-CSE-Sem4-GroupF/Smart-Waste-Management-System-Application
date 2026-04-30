import { Kafka, logLevel } from 'kafkajs';
import { BinProcessedEvent } from '../types';
import { insertJob, getJobs, hasActiveJobForBin } from '../db/queries';
import { executeEmergencyWorkflow, handleWorkflowFailure } from '../core/orchestrator';

const slog = (level: string, msg: string, job_id?: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id,
  }) + '\n');
};

const recentlyProcessed = new Map<string, number>(); // bin_id → timestamp ms
const DEDUP_WINDOW_MS   = 5 * 60 * 1000;

function pruneDedup(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [id, ts] of recentlyProcessed) {
    if (ts < cutoff) recentlyProcessed.delete(id);
  }
}

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-bin-consumer',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function startBinProcessedConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator-emergency' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.bin.processed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message, partition, heartbeat }) => {
      if (!message.value) return;
      try {
        await heartbeat();
        const envelope = JSON.parse(message.value.toString());
        const p        = (envelope.payload ?? envelope) as BinProcessedEvent;

        // Step 1: Filter urgency
        if (Number(p.urgency_score) < 80) return;

        const bin_id       = p.bin_id;
        const urgency      = Number(p.urgency_score);
        const zone_id      = p.zone_id      ?? 'unknown';
        const waste_cat    = p.waste_category ?? 'general';

        // Step 2: Dedup — skip if processed within last 5 min
        pruneDedup();
        const lastSeen = recentlyProcessed.get(bin_id);
        if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) {
          slog('INFO', `Dedup skip: bin ${bin_id} already processed recently`);
          return;
        }

        // Step 3: Check for existing active job
        if (hasActiveJobForBin(bin_id)) {
          slog('INFO', `Active job exists for bin ${bin_id} — skipping`);
          return;
        }

        // Step 4: Create job record
        recentlyProcessed.set(bin_id, Date.now());
        const job = insertJob({
          job_type:               'emergency',
          zone_id,
          waste_category:         waste_cat,
          trigger_bin_id:         bin_id,
          trigger_urgency_score:  urgency,
          kafka_offset:           Number(message.offset),
        });
        slog('INFO', `Emergency job created for bin ${bin_id} urgency=${urgency}`, job.job_id);

        // Step 5: Start workflow asynchronously
        executeEmergencyWorkflow(job, { bin_id, urgency_score: urgency, waste_category: waste_cat, zone_id })
          .catch(e => handleWorkflowFailure(job, e));

      } catch (e) {
        slog('ERROR', `binProcessedConsumer error: ${e}`);
      }
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to waste.bin.processed');
}
