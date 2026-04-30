import { CollectionJob, BinProcessedEvent, RoutineScheduleTrigger, JobCompleteRequest, JobState } from '../types';
import { transition, updateJob, recordStep, getStateHistory } from '../db/queries';
import { step } from './stepExecutor';
import { assemble } from './waitWindowManager';
import { getClusterSnapshot, markCollected } from '../clients/binStatusClient';
import { dispatch, releaseDriver } from '../clients/schedulerClient';
import { notifyDashboard } from '../clients/notificationClient';
import { recordAudit, AuditPayload } from '../clients/hyperledgerClient';
import { publishJobCompleted } from '../kafka/producer';

const slog = (level: string, msg: string, job_id?: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id,
  }) + '\n');
};

function derivePriority(urgency_score: number): number {
  if (urgency_score >= 90) return 1;
  if (urgency_score >= 80) return 2;
  return 3;
}

export async function handleWorkflowFailure(job: CollectionJob, error: unknown): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  slog('ERROR', `Workflow failure: ${msg}`, job.job_id);
  try {
    transition(job, 'FAILED', msg);
  } catch {
    // Already in a terminal state
  }
}

export async function executeEmergencyWorkflow(
  job: CollectionJob,
  event: { bin_id: string; urgency_score: number; waste_category: string; zone_id: string },
): Promise<void> {
  try {
    // Step 1: Confirm bin urgency
    transition(job, 'BIN_CONFIRMING');

    const snapshot = await step(job, 'bin_confirmation', () =>
      getClusterSnapshot(event.zone_id).then(s => {
        if (!s) throw new Error('bin-status unavailable');
        return s;
      }),
    );

    if (!snapshot.bins.some(b => b.urgency_score >= 80)) {
      transition(job, 'CANCELLED', 'Bin no longer urgent at confirmation');
      slog('INFO', 'Job cancelled — no urgent bins remain', job.job_id);
      return;
    }

    transition(job, 'BIN_CONFIRMED');

    // Step 2: Cluster assembly + wait window
    transition(job, 'CLUSTER_ASSEMBLING');

    const clusterSet = await assemble({
      job,
      urgency_score:  event.urgency_score,
      waste_category: event.waste_category,
      zone_id:        event.zone_id,
      initialSnapshot: snapshot,
    });

    updateJob(job, {
      clusters:        clusterSet.cluster_ids,
      bins_to_collect: clusterSet.bin_ids,
      planned_weight_kg: clusterSet.total_weight_kg,
    });
    transition(job, 'CLUSTER_ASSEMBLED');

    // Step 3: Dispatch
    transition(job, 'DISPATCHING');

    let dispatchResult;
    try {
      dispatchResult = await step(job, 'dispatch', () =>
        dispatch({
          job_id:                    job.job_id,
          cluster_ids:               clusterSet.cluster_ids,
          bin_ids:                   clusterSet.bin_ids,
          total_estimated_weight_kg: clusterSet.total_weight_kg,
          waste_category:            event.waste_category,
          zone_id:                   event.zone_id,
          urgency_score:             event.urgency_score,
        }),
      { retries: 3, retryDelayMs: 2_000 });
    } catch {
      transition(job, 'ESCALATED', 'No vehicle available after 3 attempts');
      await notifyDashboard('job-escalated', {
        job_id:  job.job_id,
        zone_id: event.zone_id,
        reason:  'No available vehicle',
      });
      slog('WARN', 'Job escalated — no vehicle available', job.job_id);
      return;
    }

    updateJob(job, {
      assigned_vehicle_id: dispatchResult.vehicle_id,
      assigned_driver_id:  dispatchResult.driver_id,
      route_plan_id:       dispatchResult.route_plan_id,
      assigned_at:         new Date().toISOString(),
    });
    transition(job, 'DISPATCHED');

    // Step 4: Notify driver (handled by scheduler) + notify dashboard
    transition(job, 'DRIVER_NOTIFIED');
    await notifyDashboard('job-created', {
      job_id:            job.job_id,
      job_type:          'emergency',
      zone_id:           event.zone_id,
      zone_name:         event.zone_id,
      clusters:          clusterSet.cluster_ids,
      vehicle_id:        dispatchResult.vehicle_id,
      driver_id:         dispatchResult.driver_id,
      total_bins:        clusterSet.bin_ids.length,
      planned_weight_kg: clusterSet.total_weight_kg,
      priority:          derivePriority(event.urgency_score),
      route:             dispatchResult.route,
    });

    // Step 5: Job now IN_PROGRESS — pauses here until POST /internal/jobs/:id/complete
    transition(job, 'IN_PROGRESS');
    updateJob(job, { started_at: new Date().toISOString() });
    slog('INFO', 'Job now IN_PROGRESS — waiting for collection completion', job.job_id);

  } catch (error) {
    await handleWorkflowFailure(job, error);
  }
}

export async function executeRoutineWorkflow(
  job: CollectionJob,
  trigger: { zone_id: string; bin_ids: string[]; route_plan_id?: string; waste_category: string },
): Promise<void> {
  try {
    // Routine jobs skip BIN_CONFIRMING — go straight to CLUSTER_ASSEMBLING
    transition(job, 'CLUSTER_ASSEMBLING');

    updateJob(job, {
      clusters:        [trigger.zone_id],
      bins_to_collect: trigger.bin_ids,
      route_plan_id:   trigger.route_plan_id,
      planned_weight_kg: 0,
    });
    transition(job, 'CLUSTER_ASSEMBLED');

    // Dispatch
    transition(job, 'DISPATCHING');

    let dispatchResult;
    try {
      dispatchResult = await step(job, 'dispatch', () =>
        dispatch({
          job_id:                    job.job_id,
          cluster_ids:               [trigger.zone_id],
          bin_ids:                   trigger.bin_ids,
          total_estimated_weight_kg: 0,
          waste_category:            trigger.waste_category,
          zone_id:                   trigger.zone_id,
        }),
      { retries: 3, retryDelayMs: 2_000 });
    } catch {
      transition(job, 'ESCALATED', 'No vehicle available after 3 attempts');
      await notifyDashboard('job-escalated', {
        job_id:  job.job_id,
        zone_id: trigger.zone_id,
        reason:  'No available vehicle for routine job',
      });
      return;
    }

    updateJob(job, {
      assigned_vehicle_id: dispatchResult.vehicle_id,
      assigned_driver_id:  dispatchResult.driver_id,
      route_plan_id:       dispatchResult.route_plan_id ?? trigger.route_plan_id,
      assigned_at:         new Date().toISOString(),
    });
    transition(job, 'DISPATCHED');
    transition(job, 'DRIVER_NOTIFIED');

    await notifyDashboard('job-created', {
      job_id:     job.job_id,
      job_type:   'routine',
      zone_id:    trigger.zone_id,
      zone_name:  trigger.zone_id,
      clusters:   [trigger.zone_id],
      vehicle_id: dispatchResult.vehicle_id,
      driver_id:  dispatchResult.driver_id,
      total_bins: trigger.bin_ids.length,
      route:      dispatchResult.route,
    });

    transition(job, 'IN_PROGRESS');
    updateJob(job, { started_at: new Date().toISOString() });
    slog('INFO', 'Routine job now IN_PROGRESS', job.job_id);

  } catch (error) {
    await handleWorkflowFailure(job, error);
  }
}

export async function completeJob(job: CollectionJob, request: JobCompleteRequest): Promise<void> {
  if (job.state !== 'IN_PROGRESS') {
    throw new Error(`Cannot complete job in state ${job.state}`);
  }

  transition(job, 'COMPLETING');

  // Step 1: Mark each bin collected
  for (const bin of request.bins_collected) {
    const ok = await markCollected(bin.bin_id, job.job_id, bin.collected_at);
    recordStep(job, `mark-collected:${bin.bin_id}`, 1, ok, 0);
  }

  // Step 2: Update metrics
  const startedMs      = Date.parse(job.started_at ?? job.created_at);
  const actualDuration = Math.round((Date.now() - startedMs) / 60_000);

  updateJob(job, {
    actual_weight_kg:   request.actual_weight_kg,
    actual_distance_km: request.actual_distance_km,
    actual_duration_min: actualDuration,
    collection_done_at:  new Date().toISOString(),
  });
  transition(job, 'COLLECTION_DONE');

  // Step 3: Hyperledger audit (with retries)
  transition(job, 'RECORDING_AUDIT');

  const auditPayload: AuditPayload = {
    job_id:            job.job_id,
    job_type:          job.job_type,
    zone_id:           job.zone_id,
    driver_id:         request.driver_id || job.assigned_driver_id,
    vehicle_id:        request.vehicle_id || job.assigned_vehicle_id,
    bins_collected:    request.bins_collected.map(b => ({
      bin_id:              b.bin_id,
      collected_at:        b.collected_at,
      actual_weight_kg:    b.actual_weight_kg,
    })),
    total_weight_kg:   request.actual_weight_kg,
    route_distance_km: request.actual_distance_km,
    started_at:        job.started_at,
    completed_at:      new Date().toISOString(),
  };

  let hyperledger_tx_id: string | undefined;
  try {
    const auditResult = await step(
      job,
      'hyperledger-audit',
      () => recordAudit(auditPayload),
      { retries: 3, retryDelayMs: 5_000 },
    );
    hyperledger_tx_id = auditResult.tx_id;
    updateJob(job, { hyperledger_tx_id });
    transition(job, 'AUDIT_RECORDED');
  } catch (e) {
    slog('WARN', `Hyperledger audit failed: ${e} — continuing to COMPLETED`, job.job_id);
    transition(job, 'AUDIT_FAILED');
  }

  // Step 4: Complete
  const completedAt = new Date().toISOString();
  transition(job, 'COMPLETED');
  updateJob(job, { completed_at: completedAt });

  // Step 5: Release vehicle/driver
  await releaseDriver(job.job_id);

  // Step 6: Publish Kafka event
  await publishJobCompleted({
    job_id:               job.job_id,
    job_type:             job.job_type,
    zone_id:              job.zone_id,
    vehicle_id:           request.vehicle_id || job.assigned_vehicle_id,
    driver_id:            request.driver_id  || job.assigned_driver_id,
    bins_collected_count: request.bins_collected.length,
    bins_skipped_count:   request.bins_skipped.length,
    actual_weight_kg:     request.actual_weight_kg,
    actual_distance_km:   request.actual_distance_km,
    duration_minutes:     actualDuration,
    hyperledger_tx_id,
    completed_at:         completedAt,
  });

  // Step 7: Notify dashboard
  await notifyDashboard('job-completed', {
    job_id:              job.job_id,
    zone_id:             job.zone_id,
    vehicle_id:          request.vehicle_id || job.assigned_vehicle_id,
    driver_id:           request.driver_id  || job.assigned_driver_id,
    bins_collected:      request.bins_collected.length,
    bins_skipped:        request.bins_skipped.length,
    actual_weight_kg:    request.actual_weight_kg,
    duration_minutes:    actualDuration,
    hyperledger_tx_id,
  });

  slog('INFO', 'Job COMPLETED', job.job_id);
}

export async function cancelJob(job: CollectionJob, reason: string): Promise<boolean> {
  const noCancel: JobState[] = ['IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT', 'AUDIT_RECORDED', 'COMPLETED', 'FAILED', 'ESCALATED', 'CANCELLED', 'AUDIT_FAILED'];
  if (noCancel.includes(job.state)) return false;

  if (job.assigned_driver_id) {
    await releaseDriver(job.job_id);
    await notifyDashboard('job-cancelled', {
      job_id:    job.job_id,
      zone_id:   job.zone_id,
      driver_id: job.assigned_driver_id,
      reason,
    });
  }

  transition(job, 'CANCELLED', reason, 'supervisor');
  slog('INFO', `Job CANCELLED: ${reason}`, job.job_id);
  return true;
}
