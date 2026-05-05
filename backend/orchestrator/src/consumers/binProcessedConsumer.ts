import { Kafka, logLevel } from 'kafkajs';
import * as db from '../db/queries';
import { executeEmergencyWorkflow } from '../core/orchestrator';
import { BinProcessedEvent } from '../types';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, ...extra }) + '\n');

const recentlyProcessed = new Map<string, number>();
const DEDUP_WINDOW_MS   = 5 * 60 * 1000;

function isDuplicate(binId: string): boolean {
  const last = recentlyProcessed.get(binId);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentlyProcessed.set(binId, Date.now());
  return false;
}

function hasActiveJob(binId: string): boolean {
  const TERMINAL = ['COMPLETED', 'CANCELLED', 'FAILED'];
  return db.listJobs().data.some(j =>
    !TERMINAL.includes(j.state) &&
    (j.trigger_bin_id === binId || j.bins_to_collect.includes(binId))
  );
}

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-emergency',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } } : {}),
  });
}

export async function startBinProcessedConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator-emergency' });

  await consumer.connect();
  await consumer.subscribe({ topics: ['waste.bin.processed'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const payload  = (envelope.payload ?? envelope) as BinProcessedEvent;

        if (Number(payload.urgency_score) < 80) return;

        if (hasActiveJob(payload.bin_id)) {
          slog('INFO', `Skipping bin ${payload.bin_id} — active job exists`);
          return;
        }

        if (isDuplicate(payload.bin_id)) {
          slog('INFO', `Skipping bin ${payload.bin_id} — processed within last 5 min`);
          return;
        }

        const job = db.createJob({
          job_type:               'emergency',
          zone_id:                Number(payload.zone_id),
          trigger_bin_id:         payload.bin_id,
          trigger_urgency_score:  Number(payload.urgency_score),
          trigger_waste_category: payload.waste_category,
          priority:               payload.urgency_score >= 90 ? 1 : 2,
          kafka_offset:           String(message.offset),
        });

        slog('INFO', `Emergency job ${job.id} created for bin ${payload.bin_id}`, { job_id: job.id });

        executeEmergencyWorkflow(job.id, {
          ...payload,
          zone_id:       Number(payload.zone_id),
          urgency_score: Number(payload.urgency_score),
          cluster_id:    payload.cluster_id ?? payload.bin_id,
        }).catch(e => {
          slog('ERROR', `Emergency workflow failed: ${(e as Error).message}`, { job_id: job.id });
          db.updateJobState(job.id, 'FAILED');
          db.updateJob(job.id, { failure_reason: (e as Error).message });
        });

      } catch (e) {
        slog('ERROR', `binProcessed consumer error: ${e}`);
      }
    },
  });

  slog('INFO', 'binProcessed consumer ready — group=workflow-orchestrator-emergency');
}
