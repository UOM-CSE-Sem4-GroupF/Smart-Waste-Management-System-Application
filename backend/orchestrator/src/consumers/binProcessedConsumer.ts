import { BinProcessedEvent } from '../types';
import { insertJob, hasActiveJobForBin } from '../db/queries';
import { executeEmergencyWorkflow, handleWorkflowFailure } from '../core/orchestrator';
import { startManualConsumer } from './manualConsumer';

const slog = (level: string, msg: string, job_id?: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator:binConsumer', message: msg, job_id, ...extra,
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
        const raw      = value.toString();
        const envelope = JSON.parse(raw);
        const p        = (envelope.payload ?? envelope) as BinProcessedEvent;

        const bin_id     = p.bin_id;
        const cluster_id = p.cluster_id;
        const zone_id    = String(p.zone_id ?? 'unknown');
        const urgency    = Number(p.urgency_score);
        const waste_cat  = p.waste_category ?? 'general';

        slog('DEBUG', `Received waste.bin.processed message`, undefined, {
          bin_id, cluster_id, zone_id, urgency_score: urgency, waste_category: waste_cat, offset: String(offset),
        });

        if (urgency < 80) {
          slog('DEBUG', `Skipping bin ${bin_id} — urgency ${urgency} below threshold (80)`, undefined, { bin_id, urgency });
          return;
        }

        if (!cluster_id) {
          slog('WARN', `No cluster_id in processed event for bin ${bin_id} — skipping`, undefined, { bin_id });
          return;
        }

        pruneDedup();
        if (recentlyProcessed.has(bin_id) && Date.now() - recentlyProcessed.get(bin_id)! < DEDUP_WINDOW_MS) {
          slog('INFO', `Dedup skip: bin ${bin_id} already processed recently`, undefined, { bin_id });
          return;
        }

        const hasJob = await hasActiveJobForBin(bin_id);
        if (hasJob) {
          slog('INFO', `Active job exists for bin ${bin_id} — skipping`, undefined, { bin_id });
          return;
        }

        slog('INFO', `Creating emergency job for bin ${bin_id}`, undefined, {
          bin_id, cluster_id, zone_id, urgency_score: urgency, waste_category: waste_cat,
        });

        recentlyProcessed.set(bin_id, Date.now());
        const job = await insertJob({
          job_type:              'emergency',
          zone_id,
          waste_category:        waste_cat,
          trigger_bin_id:        bin_id,
          trigger_urgency_score: urgency,
          kafka_offset:          Number(offset),
        });
        slog('INFO', `Emergency job created for bin ${bin_id} cluster=${cluster_id} urgency=${urgency}`, job.job_id, {
          bin_id, cluster_id, zone_id, urgency_score: urgency,
        });

        executeEmergencyWorkflow(job, { bin_id, cluster_id, urgency_score: urgency, waste_category: waste_cat, zone_id })
          .catch(e => handleWorkflowFailure(job, e));

      } catch (e) {
        slog('ERROR', `binProcessedConsumer error: ${(e as Error).message}`, undefined, { error: String(e) });
      }
    },
    (level, msg) => slog(level, msg),
  );

  slog('INFO', 'Kafka consumer ready — subscribed to waste.bin.processed');
}
