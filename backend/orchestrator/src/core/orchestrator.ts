import { createHash } from 'crypto';
import * as db from '../db/queries';
import { validateTransition, CANCELLABLE_STATES } from './stateMachine';
import { step } from './stepExecutor';
import { assemble } from './waitWindowManager';
import { getClusterSnapshot, markBinCollected } from '../clients/binStatusClient';
import { dispatch as schedulerDispatch, release as schedulerRelease } from '../clients/schedulerClient';
import { notifyJobCreated, notifyJobCompleted, notifyJobEscalated, notifyJobCancelled } from '../clients/notificationClient';
import { recordCollection } from '../clients/hyperledgerClient';
import { publishJobCompleted } from '../kafka/producer';
import { BinProcessedEvent, JobState, JobCompleteRequest } from '../types';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, ...extra }) + '\n');

export function derivePriority(urgencyScore: number): number {
  if (urgencyScore >= 90) return 1;
  if (urgencyScore >= 80) return 2;
  return 3;
}

async function updateState(jobId: string, toState: JobState, reason?: string, actor = 'system'): Promise<void> {
  const job = db.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  const fromState = job.state;
  validateTransition(fromState, toState);
  db.updateJobState(jobId, toState);
  db.insertStateTransition({ job_id: jobId, from_state: fromState, to_state: toState, reason, actor });
}

async function handleWorkflowFailure(jobId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  slog('ERROR', `Workflow failure: ${msg}`, { job_id: jobId });
  try {
    const job = db.getJob(jobId);
    if (job && !['COMPLETED', 'CANCELLED', 'ESCALATED', 'FAILED'].includes(job.state)) {
      db.insertStateTransition({ job_id: jobId, from_state: job.state, to_state: 'FAILED', reason: msg });
      db.updateJobState(jobId, 'FAILED');
      db.updateJob(jobId, { failure_reason: msg });
    }
  } catch { /* best-effort */ }
}

// ── Emergency workflow ────────────────────────────────────────────────────────

export async function executeEmergencyWorkflow(
  jobId: string,
  binEvent: BinProcessedEvent,
): Promise<void> {
  try {
    // Step 1: Confirm bin urgency
    await updateState(jobId, 'BIN_CONFIRMING');

    const snapshot = await step(jobId, 'bin_confirmation', () =>
      getClusterSnapshot(binEvent.cluster_id)
    );

    if (!snapshot.bins.some(b => b.urgency_score >= 80)) {
      await updateState(jobId, 'CANCELLED', 'Bin no longer urgent at confirmation');
      return;
    }

    await updateState(jobId, 'BIN_CONFIRMED');

    // Step 2: Wait window + cluster assembly
    await updateState(jobId, 'CLUSTER_ASSEMBLING');

    const clusterSet = await assemble({ jobId, triggerBinEvent: binEvent, initialSnapshot: snapshot });

    db.updateJob(jobId, {
      clusters:         clusterSet.cluster_ids,
      bins_to_collect:  clusterSet.bin_ids,
      planned_weight_kg: clusterSet.total_weight_kg,
    });

    await updateState(jobId, 'CLUSTER_ASSEMBLED');

    // Step 3: Dispatch
    await updateState(jobId, 'DISPATCHING');

    let dispatchResult;
    try {
      dispatchResult = await step(jobId, 'dispatch', () =>
        schedulerDispatch({
          job_id:                    jobId,
          clusters:                  clusterSet.cluster_ids,
          bins_to_collect:           clusterSet.bin_ids,
          total_estimated_weight_kg: clusterSet.total_weight_kg,
          waste_category:            binEvent.waste_category,
          zone_id:                   binEvent.zone_id,
          priority:                  derivePriority(binEvent.urgency_score),
        }),
      { retries: 3, retryDelayMs: 2_000 });
    } catch {
      dispatchResult = { success: false } as const;
    }

    if (!dispatchResult.success) {
      await updateState(jobId, 'ESCALATED', 'No vehicle available after 3 attempts');
      db.updateJob(jobId, { escalated_at: new Date().toISOString() });
      await notifyJobEscalated({
        job_id: jobId, zone_id: binEvent.zone_id,
        reason: 'No available vehicle', urgent_bins: [], total_weight_kg: clusterSet.total_weight_kg,
      });
      return;
    }

    db.updateJob(jobId, {
      assigned_vehicle_id: dispatchResult.vehicle_id,
      assigned_driver_id:  dispatchResult.driver_id,
      route_plan_id:       dispatchResult.route_plan_id,
      assigned_at:         new Date().toISOString(),
    });

    await updateState(jobId, 'DISPATCHED');

    // Step 4: Driver notified (scheduler handles push; orchestrator notifies dashboard)
    await updateState(jobId, 'DRIVER_NOTIFIED');

    const job = db.getJob(jobId)!;
    await notifyJobCreated({
      job_id:           jobId,
      job_type:         'emergency',
      zone_id:          binEvent.zone_id,
      zone_name:        job.zone_name ?? '',
      clusters:         clusterSet.cluster_ids,
      vehicle_id:       dispatchResult.vehicle_id,
      driver_id:        dispatchResult.driver_id,
      route:            dispatchResult.route ?? [],
      total_bins:       clusterSet.bin_ids.length,
      planned_weight_kg: clusterSet.total_weight_kg,
      priority:         derivePriority(binEvent.urgency_score),
    });

    // Step 5: IN_PROGRESS — workflow pauses until scheduler calls /internal/jobs/:id/complete
    await updateState(jobId, 'IN_PROGRESS');
    db.updateJob(jobId, { started_at: new Date().toISOString() });

    slog('INFO', `Job ${jobId} IN_PROGRESS — awaiting scheduler completion callback`, { job_id: jobId });

  } catch (error) {
    await handleWorkflowFailure(jobId, error);
  }
}

// ── Routine workflow ──────────────────────────────────────────────────────────

export async function executeRoutineWorkflow(
  jobId: string,
  trigger: { zone_id: number; zone_name: string; bin_ids: string[]; route_plan_id: string; scheduled_date: string },
): Promise<void> {
  try {
    // Routine jobs skip BIN_CONFIRMING and wait window
    await updateState(jobId, 'CLUSTER_ASSEMBLING');

    db.updateJob(jobId, {
      bins_to_collect: trigger.bin_ids,
      route_plan_id:   trigger.route_plan_id,
    });

    await updateState(jobId, 'CLUSTER_ASSEMBLED');
    await updateState(jobId, 'DISPATCHING');

    let dispatchResult;
    try {
      dispatchResult = await step(jobId, 'dispatch', () =>
        schedulerDispatch({
          job_id:                    jobId,
          clusters:                  [],
          bins_to_collect:           trigger.bin_ids,
          total_estimated_weight_kg: 0,
          waste_category:            'general',
          zone_id:                   trigger.zone_id,
          priority:                  3,
        }),
      { retries: 3, retryDelayMs: 2_000 });
    } catch {
      dispatchResult = { success: false } as const;
    }

    if (!dispatchResult.success) {
      await updateState(jobId, 'ESCALATED', 'No vehicle available for routine job');
      db.updateJob(jobId, { escalated_at: new Date().toISOString() });
      await notifyJobEscalated({
        job_id: jobId, zone_id: trigger.zone_id,
        reason: 'No vehicle available for scheduled routine', urgent_bins: [], total_weight_kg: 0,
      });
      return;
    }

    db.updateJob(jobId, {
      assigned_vehicle_id: dispatchResult.vehicle_id,
      assigned_driver_id:  dispatchResult.driver_id,
      route_plan_id:       dispatchResult.route_plan_id ?? trigger.route_plan_id,
      assigned_at:         new Date().toISOString(),
    });

    await updateState(jobId, 'DISPATCHED');
    await updateState(jobId, 'DRIVER_NOTIFIED');

    const job = db.getJob(jobId)!;
    await notifyJobCreated({
      job_id:           jobId,
      job_type:         'routine',
      zone_id:          trigger.zone_id,
      zone_name:        trigger.zone_name,
      clusters:         [],
      vehicle_id:       dispatchResult.vehicle_id,
      driver_id:        dispatchResult.driver_id,
      route:            dispatchResult.route ?? [],
      total_bins:       trigger.bin_ids.length,
      planned_weight_kg: 0,
      priority:         3,
    });

    await updateState(jobId, 'IN_PROGRESS');
    db.updateJob(jobId, { started_at: new Date().toISOString() });

    slog('INFO', `Routine job ${jobId} IN_PROGRESS`, { job_id: jobId });

  } catch (error) {
    await handleWorkflowFailure(jobId, error);
  }
}

// ── Completion handler (called from POST /internal/jobs/:id/complete) ─────────

export async function handleJobCompletion(jobId: string, req: JobCompleteRequest): Promise<void> {
  const job = db.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.state !== 'IN_PROGRESS') throw new Error(`Job ${jobId} is not IN_PROGRESS (current: ${job.state})`);

  try {
    // Step 1: Mark bins and transition
    await updateState(jobId, 'COMPLETING');

    for (const b of req.bins_collected) {
      await markBinCollected(b.bin_id, {
        job_id:                   jobId,
        collected_at:             b.collected_at,
        fill_level_at_collection: b.fill_level_at_collection,
        actual_weight_kg:         b.actual_weight_kg,
        gps_lat:                  b.gps_lat,
        gps_lng:                  b.gps_lng,
      });
      db.upsertBinCollection({
        job_id: jobId, bin_id: b.bin_id, sequence_number: 0,
        status: 'collected', collected_at: b.collected_at,
        fill_level_at_collection: b.fill_level_at_collection,
        estimated_weight_kg: 0, actual_weight_kg: b.actual_weight_kg,
      });
    }

    for (const b of req.bins_skipped) {
      db.upsertBinCollection({
        job_id: jobId, bin_id: b.bin_id, sequence_number: 0,
        status: 'skipped', estimated_weight_kg: 0, skip_reason: b.skip_reason,
      });
    }

    // Step 2: Metrics
    const collectionDoneAt  = new Date().toISOString();
    const actualDurationMin = job.started_at
      ? Math.round((Date.now() - new Date(job.started_at).getTime()) / 60_000) : 0;

    db.updateJob(jobId, {
      actual_weight_kg:    req.actual_weight_kg,
      actual_distance_km:  req.actual_distance_km,
      actual_duration_min: actualDurationMin,
      collection_done_at:  collectionDoneAt,
    });

    await updateState(jobId, 'COLLECTION_DONE');

    // Step 3: Hyperledger
    await updateState(jobId, 'RECORDING_AUDIT');

    const gpsTrailHash = createHash('sha256')
      .update(JSON.stringify(req.route_gps_trail))
      .digest('hex');

    let hyperledgerTxId: string | null = null;
    try {
      const hlResult = await step(jobId, 'hyperledger_audit', () =>
        recordCollection({
          job_id:            jobId,
          job_type:          job.job_type,
          zone_id:           job.zone_id,
          driver_id:         req.driver_id,
          vehicle_id:        req.vehicle_id,
          bins_collected:    req.bins_collected,
          total_weight_kg:   req.actual_weight_kg,
          route_distance_km: req.actual_distance_km,
          started_at:        job.started_at!,
          completed_at:      collectionDoneAt,
          gps_trail_hash:    gpsTrailHash,
        }),
      { retries: 3, retryDelayMs: 5_000 });
      hyperledgerTxId = hlResult.tx_id;
      db.updateJob(jobId, { hyperledger_tx_id: hyperledgerTxId });
      await updateState(jobId, 'AUDIT_RECORDED');
    } catch (e) {
      slog('WARN', `Hyperledger audit failed — continuing: ${(e as Error).message}`, { job_id: jobId });
      await updateState(jobId, 'AUDIT_FAILED', 'Hyperledger unavailable');
    }

    // Step 4: Complete
    const completedAt = new Date().toISOString();
    db.updateJob(jobId, { completed_at: completedAt });
    await updateState(jobId, 'COMPLETED');

    slog('INFO', `Job ${jobId} COMPLETED`, { job_id: jobId });

    // Step 5: Publish Kafka
    await publishJobCompleted({
      job_id:               jobId,
      job_type:             job.job_type,
      zone_id:              job.zone_id,
      vehicle_id:           req.vehicle_id,
      driver_id:            req.driver_id,
      bins_collected_count: req.bins_collected.length,
      bins_skipped_count:   req.bins_skipped.length,
      actual_weight_kg:     req.actual_weight_kg,
      actual_distance_km:   req.actual_distance_km,
      duration_minutes:     actualDurationMin,
      hyperledger_tx_id:    hyperledgerTxId,
      completed_at:         completedAt,
    });

    // Step 6: Notify dashboard
    await notifyJobCompleted({
      job_id:           jobId,
      zone_id:          job.zone_id,
      vehicle_id:       req.vehicle_id,
      driver_id:        req.driver_id,
      bins_collected:   req.bins_collected.length,
      bins_skipped:     req.bins_skipped.length,
      actual_weight_kg: req.actual_weight_kg,
      duration_minutes: actualDurationMin,
      hyperledger_tx_id: hyperledgerTxId,
    });

  } catch (error) {
    await handleWorkflowFailure(jobId, error);
    throw error;
  }
}

// ── Cancel handler ────────────────────────────────────────────────────────────

export async function cancelJobById(jobId: string, reason: string, actor = 'supervisor'): Promise<void> {
  const job = db.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.state === 'IN_PROGRESS') {
    throw new Error('Cannot cancel job while driver is collecting');
  }
  if (!(CANCELLABLE_STATES as readonly string[]).includes(job.state)) {
    throw new Error(`Cannot cancel job in state ${job.state}`);
  }

  if (job.assigned_driver_id) {
    await schedulerRelease(jobId);
    await notifyJobCancelled({
      job_id:    jobId,
      zone_id:   job.zone_id,
      driver_id: job.assigned_driver_id,
      reason,
    });
  }

  db.insertStateTransition({ job_id: jobId, from_state: job.state, to_state: 'CANCELLED', reason, actor });
  db.updateJobState(jobId, 'CANCELLED');
}
