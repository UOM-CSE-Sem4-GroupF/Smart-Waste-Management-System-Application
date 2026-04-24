import { CollectionJob } from '../types';
import { transition, recordStep } from '../store';
import { confirmUrgency, markCollected } from '../clients/bin-status';
import { assignDriver, releaseDriver } from '../clients/scheduler';
import { notifyJobAssigned, notifyJobCancelled, notifyJobEscalated } from '../clients/notification';

const MAX_DRIVER_RETRIES = 3;

const slog = (level: string, msg: string, job_id?: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id }) + '\n');

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runStateMachine(job: CollectionJob): Promise<void> {
  slog('INFO', `State machine start: ${job.job_id} (${job.job_type})`, job.job_id);
  try {
    await stepConfirmBins(job);
    if (['CANCELLED', 'FAILED'].includes(job.state)) return;

    await stepLoadRoute(job);

    await stepAssignDriver(job);
    if (['ESCALATED', 'FAILED'].includes(job.state)) return;

    await stepNotifyDriver(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    transition(job, 'FAILED', msg);
    slog('ERROR', `Unhandled error: ${msg}`, job.job_id);
  }
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function stepConfirmBins(job: CollectionJob): Promise<void> {
  if (job.job_type === 'routine') return; // routine jobs skip urgency confirmation

  transition(job, 'BIN_CONFIRMING');

  let totalWeight = 0;
  let anyConfirmed = false;

  for (const bin_id of job.bin_ids) {
    const result = await confirmUrgency(bin_id);
    recordStep(job, `confirm-urgency:${bin_id}`, result !== null, result);

    if (result === null) {
      // bin-status service unavailable or bin not found — proceed cautiously
      slog('WARN', `Cannot confirm ${bin_id} — assuming urgency still valid`, job.job_id);
      anyConfirmed  = true;
      totalWeight  += 200; // fallback estimate
    } else if (result.confirmed) {
      anyConfirmed  = true;
      totalWeight  += result.estimated_weight_kg;
    }
  }

  if (!anyConfirmed) {
    transition(job, 'CANCELLED', 'Bin urgency resolved before collection started');
    slog('INFO', `Job cancelled — no urgent bins remain`, job.job_id);
    return;
  }

  job.planned_weight_kg = totalWeight;
  transition(job, 'BIN_CONFIRMED');
}

async function stepLoadRoute(job: CollectionJob): Promise<void> {
  transition(job, 'ROUTE_LOADING');
  // Route is pre-computed by F2 OR-Tools and stored by route_id.
  // For emergency jobs, OR-Tools computes in real-time; route_id arrives via waste.routes.optimized.
  // For routine jobs, route_id is part of the trigger message.
  recordStep(job, 'route-loading', true, { route_id: job.route_id ?? 'pending-f2-assignment' });
  transition(job, 'ROUTE_LOADED');
}

async function stepAssignDriver(job: CollectionJob): Promise<void> {
  const excludeDrivers: string[] = [];

  for (let attempt = 0; attempt < MAX_DRIVER_RETRIES; attempt++) {
    transition(job, 'ASSIGNING_DRIVER');

    const result = await assignDriver({
      job_id:              job.job_id,
      zone_id:             job.zone_id,
      waste_category:      job.waste_category,
      planned_weight_kg:   job.planned_weight_kg ?? 0,
      exclude_driver_ids:  excludeDrivers,
    });

    recordStep(job, `assign-driver:attempt-${attempt + 1}`, result !== null, result);

    if (result) {
      job.driver_id  = result.driver_id;
      job.vehicle_id = result.vehicle_id;
      transition(job, 'DRIVER_ASSIGNED');
      return;
    }

    slog('WARN', `Driver assignment attempt ${attempt + 1}/${MAX_DRIVER_RETRIES} failed`, job.job_id);
  }

  // All retries exhausted — escalate
  transition(job, 'ESCALATED', `No driver available after ${MAX_DRIVER_RETRIES} attempts`);
  await notifyJobEscalated({ job_id: job.job_id, zone_id: job.zone_id, reason: 'No driver found after max retries' });
  slog('WARN', `Job escalated — no driver available`, job.job_id);
}

async function stepNotifyDriver(job: CollectionJob): Promise<void> {
  if (!job.driver_id) return;

  transition(job, 'NOTIFYING_DRIVER');

  const ok = await notifyJobAssigned({
    job_id:         job.job_id,
    driver_id:      job.driver_id,
    vehicle_id:     job.vehicle_id,
    zone_id:        job.zone_id,
    waste_category: job.waste_category,
    estimated_bins: job.bin_ids.length,
    route_id:       job.route_id,
  });
  recordStep(job, 'notify-driver', ok);

  transition(job, 'DRIVER_NOTIFIED');
  transition(job, 'AWAITING_ACCEPTANCE');

  slog('INFO', `Driver ${job.driver_id} notified — awaiting acceptance (10 min timeout)`, job.job_id);

  // In production: a 10-min timer fires and escalates if no driver response.
  // Driver response arrives via waste.driver.responses Kafka topic (handled in consumer.ts).
}

// ── Driver response handler (called from Kafka consumer) ──────────────────────

export async function handleDriverResponse(
  job:      CollectionJob,
  response: 'accepted' | 'rejected',
  reason?:  string,
): Promise<void> {
  if (job.state !== 'AWAITING_ACCEPTANCE') {
    slog('WARN', `Driver response received but job is in state ${job.state}`, job.job_id);
    return;
  }

  if (response === 'accepted') {
    transition(job, 'DRIVER_ACCEPTED');
    transition(job, 'IN_PROGRESS');
    slog('INFO', `Driver ${job.driver_id} accepted — job now IN_PROGRESS`, job.job_id);
    return;
  }

  // Driver rejected — release and try to reassign
  slog('WARN', `Driver ${job.driver_id} rejected: ${reason}`, job.job_id);
  job.driver_rejection_count++;

  const rejectedDriver = job.driver_id!;
  if (job.driver_id) await releaseDriver(job.job_id);
  await notifyJobCancelled({ job_id: job.job_id, driver_id: rejectedDriver, reason: `Driver rejected: ${reason}` });

  if (job.driver_rejection_count >= MAX_DRIVER_RETRIES) {
    transition(job, 'ESCALATED', `Rejected by ${MAX_DRIVER_RETRIES} drivers`);
    await notifyJobEscalated({ job_id: job.job_id, zone_id: job.zone_id, reason: `All ${MAX_DRIVER_RETRIES} driver assignments rejected` });
    return;
  }

  transition(job, 'DRIVER_REASSIGNMENT');
  recordStep(job, `driver-rejection:${job.driver_rejection_count}`, false, { driver_id: rejectedDriver, reason });

  // Reassign excluding the rejected driver
  // Collect all previously rejected driver IDs from step results
  const previouslyRejected = job.step_results
    .filter(s => s.step.startsWith('driver-rejection:'))
    .map(s => (s.detail as { driver_id?: string })?.driver_id)
    .filter((id): id is string => !!id);
  const excludeDrivers = [...new Set([...previouslyRejected, rejectedDriver])];

  const result = await assignDriver({
    job_id:             job.job_id,
    zone_id:            job.zone_id,
    waste_category:     job.waste_category,
    planned_weight_kg:  job.planned_weight_kg ?? 0,
    exclude_driver_ids: excludeDrivers,
  });

  if (!result) {
    transition(job, 'ESCALATED', 'No driver available after rejection');
    await notifyJobEscalated({ job_id: job.job_id, zone_id: job.zone_id, reason: 'No replacement driver found' });
    return;
  }

  job.driver_id  = result.driver_id;
  job.vehicle_id = result.vehicle_id;
  transition(job, 'DRIVER_ASSIGNED');
  recordStep(job, `reassign-driver`, true, result);

  await stepNotifyDriver(job);
}

// ── Terminal transitions (called from REST routes) ────────────────────────────

export async function acceptJob(job: CollectionJob): Promise<boolean> {
  if (job.state !== 'AWAITING_ACCEPTANCE') return false;
  transition(job, 'DRIVER_ACCEPTED');
  transition(job, 'IN_PROGRESS');
  slog('INFO', `Job accepted via REST — now IN_PROGRESS`, job.job_id);
  return true;
}

export async function completeJob(job: CollectionJob): Promise<boolean> {
  if (job.state !== 'IN_PROGRESS') return false;

  transition(job, 'COMPLETING');

  // Mark all bins as collected in bin-status service
  for (const bin_id of job.bin_ids) {
    const ok = await markCollected(bin_id, job.job_id);
    recordStep(job, `mark-collected:${bin_id}`, ok);
  }

  await releaseDriver(job.job_id);
  transition(job, 'COLLECTION_DONE');

  // Record on Hyperledger (stubbed — F4 provides the client)
  transition(job, 'RECORDING_AUDIT');
  recordStep(job, 'hyperledger-audit', true, { stub: 'Hyperledger chaincode call goes here' });
  transition(job, 'AUDIT_RECORDED');
  transition(job, 'COMPLETED');

  job.completed_at = new Date().toISOString();
  slog('INFO', `Job COMPLETED`, job.job_id);
  return true;
}

export async function cancelJob(job: CollectionJob, reason: string): Promise<boolean> {
  const terminal: CollectionJob['state'][] = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (terminal.includes(job.state)) return false;

  if (job.driver_id) {
    await releaseDriver(job.job_id);
    await notifyJobCancelled({ job_id: job.job_id, driver_id: job.driver_id, reason });
  }

  transition(job, 'CANCELLED', reason);
  slog('INFO', `Job CANCELLED: ${reason}`, job.job_id);
  return true;
}
