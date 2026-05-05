import { BinProcessedEvent } from '../types';
import { insertJob, hasActiveJobForBin } from '../db/queries';
import { executeEmergencyWorkflow, handleWorkflowFailure } from '../core/orchestrator';
import { startManualConsumer } from './manualConsumer';

const slog = (level: string, msg: string, job_id?: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id,
  }) + '\n');
};

const recentlyProcessed = new Map<string, number>();
const DEDUP_WINDOW_MS   = 5 * 60 * 1000;

function pruneDedup(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [id, ts] of recentlyProcessed) {
    if (ts < cutoff) recentlyProcessed.delete(id);
  }
}

export async function startBinProcessedConsumer(): Promise<void> {
  await startManualConsumer(
    'workflow-orchestrator-bin-consumer',
    'waste.bin.processed',
    async (value, _partition, offset) => {
      try {
        const envelope = JSON.parse(value.toString());
        const p        = (envelope.payload ?? envelope) as BinProcessedEvent;

        if (Number(p.urgency_score) < 80) return;

        const bin_id    = p.bin_id;
        const urgency   = Number(p.urgency_score);
        const zone_id   = p.zone_id      ?? 'unknown';
        const waste_cat = p.waste_category ?? 'general';

        pruneDedup();
        const lastSeen = recentlyProcessed.get(bin_id);
        if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) {
          slog('INFO', `Dedup skip: bin ${bin_id} already processed recently`);
          return;
        }

        if (await hasActiveJobForBin(bin_id)) {
          slog('INFO', `Active job exists for bin ${bin_id} — skipping`);
          return;
        }

        recentlyProcessed.set(bin_id, Date.now());
        const job = await insertJob({
          job_type:              'emergency',
          zone_id,
          waste_category:        waste_cat,
          trigger_bin_id:        bin_id,
          trigger_urgency_score: urgency,
          kafka_offset:          Number(offset),
        });
        slog('INFO', `Emergency job created for bin ${bin_id} urgency=${urgency}`, job.job_id);

        executeEmergencyWorkflow(job, { bin_id, urgency_score: urgency, waste_category: waste_cat, zone_id })
          .catch(e => handleWorkflowFailure(job, e));

      } catch (e) {
        slog('ERROR', `binProcessedConsumer error: ${e}`);
      }
    },
    (level, msg) => slog(level, msg),
  );

  slog('INFO', 'Kafka consumer ready — subscribed to waste.bin.processed');
}
