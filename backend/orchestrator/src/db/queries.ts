import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { CollectionJob, JobType, JobState, StateTransition, StepResult } from '../types';
import { validateTransition } from '../core/stateMachine';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — map DB rows to the application's CollectionJob shape
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(row: any): CollectionJob {
  const e = row.emergency_details;
  const r = row.routine_details;
  const m = row.execution_metrics;
  return {
    job_id:                 row.id,
    job_type:               row.job_type as JobType,
    state:                  row.state as JobState,
    zone_id:                String(row.zone_id),
    waste_category:         e?.trigger_waste_category ?? r?.waste_category_id?.toString() ?? '',
    trigger_bin_id:         e?.trigger_bin_id,
    trigger_urgency_score:  e?.trigger_urgency_score,
    clusters:               e?.cluster_ids ?? r?.cluster_ids ?? [],
    bins_to_collect:        e?.bin_ids ?? r?.bin_ids ?? [],
    assigned_vehicle_id:    row.assigned_vehicle_id ?? undefined,
    assigned_driver_id:     row.assigned_driver_id ?? undefined,
    route_plan_id:          row.route_plan_id ?? undefined,
    planned_weight_kg:      row.planned_weight_kg ? Number(row.planned_weight_kg) : undefined,
    actual_weight_kg:       m?.actual_weight_kg ? Number(m.actual_weight_kg) : undefined,
    actual_distance_km:     m?.actual_distance_km ? Number(m.actual_distance_km) : undefined,
    actual_duration_min:    m?.actual_duration_min ?? undefined,
    hyperledger_tx_id:      m?.hyperledger_tx_id ?? undefined,
    failure_reason:         e?.failure_reason ?? r?.failure_reason ?? undefined,
    schedule_id:            r?.schedule_id ?? undefined,
    kafka_offset:           m?.kafka_offset ? Number(m.kafka_offset) : undefined,
    created_at:             row.created_at.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// insertJob — creates the core job row + the type-specific details row
// ─────────────────────────────────────────────────────────────────────────────
export async function insertJob(params: {
  job_type:               JobType;
  zone_id:                string;
  waste_category:         string;
  trigger_bin_id?:        string;
  trigger_cluster_id?:    string;
  trigger_urgency_score?: number;
  schedule_id?:           string;
  kafka_offset?:          number;
}): Promise<CollectionJob> {
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.collectionJob.create({
      data: {
        job_type: params.job_type,
        zone_id:  parseInt(params.zone_id, 10),
        state:    'CREATED',
        priority: params.job_type === 'emergency' ? 9 : 5,
      },
    });

    // Insert the initial state transition
    await tx.jobStateTransition.create({
      data: {
        job_id:     job.id,
        from_state: null,
        to_state:   'CREATED',
        actor:      'system',
      },
    });

    // Insert type-specific details
    if (params.job_type === 'emergency') {
      await tx.emergencyJobDetails.create({
        data: {
          job_id:                 job.id,
          trigger_bin_id:         params.trigger_bin_id ?? 'unknown',
          trigger_cluster_id:     params.trigger_cluster_id ?? 'unknown',
          trigger_urgency_score:  params.trigger_urgency_score ?? 0,
          trigger_waste_category: params.waste_category,
        },
      });
    } else {
      await tx.routineJobDetails.create({
        data: {
          job_id:          job.id,
          scheduled_date:  new Date(),
          scheduled_time:  new Date(),
          schedule_id:     params.schedule_id ?? undefined,
        },
      });
    }

    return job;
  });

  const full = await prisma.collectionJob.findUniqueOrThrow({
    where:   { id: result.id },
    include: { emergency_details: true, routine_details: true, execution_metrics: true },
  });
  return rowToJob(full);
}

// ─────────────────────────────────────────────────────────────────────────────
// getJob
// ─────────────────────────────────────────────────────────────────────────────
export async function getJob(id: string): Promise<CollectionJob | undefined> {
  const row = await prisma.collectionJob.findUnique({
    where:   { id },
    include: { emergency_details: true, routine_details: true, execution_metrics: true },
  });
  return row ? rowToJob(row) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateJob — patches columns on the core job row + detail rows
// ─────────────────────────────────────────────────────────────────────────────
export async function updateJob(
  job: CollectionJob,
  patch: Partial<Omit<CollectionJob, 'job_id' | 'job_type' | 'created_at' | 'state'>>,
): Promise<void> {
  // Apply patch to the local object so callers see the updated shape immediately
  Object.assign(job, patch);

  await prisma.$transaction(async (tx) => {
    // Core job columns — use UncheckedUpdateInput so FK scalars (assigned_driver_id) can be set directly
    const coreUpdate: Prisma.CollectionJobUncheckedUpdateInput = {};
    if (patch.assigned_vehicle_id !== undefined) coreUpdate.assigned_vehicle_id = patch.assigned_vehicle_id;
    if (patch.assigned_driver_id  !== undefined) coreUpdate.assigned_driver_id  = patch.assigned_driver_id;
    if (patch.route_plan_id       !== undefined) coreUpdate.route_plan_id        = patch.route_plan_id;
    if (patch.planned_weight_kg   !== undefined) coreUpdate.planned_weight_kg    = patch.planned_weight_kg;

    if (Object.keys(coreUpdate).length > 0) {
      await tx.collectionJob.update({ where: { id: job.job_id }, data: coreUpdate });
    }

    // Emergency detail columns
    const emergencyUpdate: Prisma.EmergencyJobDetailsUpdateInput = {};
    if (patch.clusters           !== undefined) emergencyUpdate.cluster_ids    = patch.clusters;
    if (patch.bins_to_collect    !== undefined) emergencyUpdate.bin_ids        = patch.bins_to_collect;
    if (patch.failure_reason     !== undefined) emergencyUpdate.failure_reason = patch.failure_reason;

    if (job.job_type === 'emergency' && Object.keys(emergencyUpdate).length > 0) {
      await tx.emergencyJobDetails.update({ where: { job_id: job.job_id }, data: emergencyUpdate });
    }

    // Routine detail columns
    const routineUpdate: Prisma.RoutineJobDetailsUpdateInput = {};
    if (patch.clusters        !== undefined) routineUpdate.cluster_ids    = patch.clusters;
    if (patch.bins_to_collect !== undefined) routineUpdate.bin_ids        = patch.bins_to_collect;
    if (patch.failure_reason  !== undefined) routineUpdate.failure_reason = patch.failure_reason;

    if (job.job_type === 'routine' && Object.keys(routineUpdate).length > 0) {
      await tx.routineJobDetails.update({ where: { job_id: job.job_id }, data: routineUpdate });
    }

    // Execution metrics upsert
    const metricsData: Prisma.JobExecutionMetricsCreateInput = {
      job: { connect: { id: job.job_id } },
      actual_weight_kg:   patch.actual_weight_kg,
      actual_distance_km: patch.actual_distance_km,
      actual_duration_min:patch.actual_duration_min,
      hyperledger_tx_id:  patch.hyperledger_tx_id,
      kafka_offset:       patch.kafka_offset ? BigInt(patch.kafka_offset) : undefined,
    };
    const metricsUpdate: Prisma.JobExecutionMetricsUpdateInput = {
      actual_weight_kg:   patch.actual_weight_kg,
      actual_distance_km: patch.actual_distance_km,
      actual_duration_min:patch.actual_duration_min,
      hyperledger_tx_id:  patch.hyperledger_tx_id,
      kafka_offset:       patch.kafka_offset ? BigInt(patch.kafka_offset) : undefined,
    };

    const hasMetrics = [
      patch.actual_weight_kg,
      patch.actual_distance_km,
      patch.actual_duration_min,
      patch.hyperledger_tx_id,
      patch.kafka_offset,
    ].some((v) => v !== undefined);

    if (hasMetrics) {
      await tx.jobExecutionMetrics.upsert({
        where:  { job_id: job.job_id },
        create: metricsData,
        update: metricsUpdate,
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// transition — validates then persists the new state
// ─────────────────────────────────────────────────────────────────────────────
export async function transition(
  job: CollectionJob,
  to: JobState,
  reason?: string,
  actor = 'system',
): Promise<void> {
  validateTransition(job.state, to);
  const from = job.state;
  job.state = to; // update in-memory immediately

  await prisma.$transaction([
    prisma.collectionJob.update({
      where: { id: job.job_id },
      data:  { state: to },
    }),
    prisma.jobStateTransition.create({
      data: {
        job_id:     job.job_id,
        from_state: from,
        to_state:   to,
        reason,
        actor,
      },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// recordStep — appends a step audit log row
// ─────────────────────────────────────────────────────────────────────────────
export async function recordStep(
  job: CollectionJob,
  step_name: string,
  attempt_number: number,
  success: boolean,
  duration_ms: number,
  error_message?: string,
): Promise<void> {
  await prisma.jobStepResult.create({
    data: {
      job_id:         job.job_id,
      step_name,
      attempt_number,
      success,
      duration_ms,
      error_message,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getStateHistory
// ─────────────────────────────────────────────────────────────────────────────
export async function getStateHistory(job_id: string): Promise<StateTransition[]> {
  const rows = await prisma.jobStateTransition.findMany({
    where:   { job_id },
    orderBy: { transitioned_at: 'asc' },
  });
  return rows.map((r) => ({
    from_state:      (r.from_state ?? null) as JobState | null,
    to_state:        r.to_state as JobState,
    reason:          r.reason ?? undefined,
    actor:           r.actor ?? 'system',
    transitioned_at: r.transitioned_at.toISOString(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// getStepLog
// ─────────────────────────────────────────────────────────────────────────────
export async function getStepLog(job_id: string): Promise<StepResult[]> {
  const rows = await prisma.jobStepResult.findMany({
    where:   { job_id },
    orderBy: { executed_at: 'asc' },
  });
  return rows.map((r) => ({
    step_name:      r.step_name,
    attempt_number: r.attempt_number,
    success:        r.success,
    duration_ms:    r.duration_ms ?? 0,
    error_message:  r.error_message ?? undefined,
    executed_at:    r.executed_at.toISOString(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// hasActiveJobForBin — checks if there's a non-terminal job containing the bin
// ─────────────────────────────────────────────────────────────────────────────
export async function hasActiveJobForBin(bin_id: string): Promise<boolean> {
  const TERMINAL = ['COMPLETED', 'CANCELLED', 'FAILED', 'ESCALATED'];

  const emergency = await prisma.emergencyJobDetails.findFirst({
    where: {
      OR: [
        { trigger_bin_id: bin_id },
        { bin_ids: { has: bin_id } },
      ],
      job: { state: { notIn: TERMINAL } },
    },
  });
  if (emergency) return true;

  const routine = await prisma.routineJobDetails.findFirst({
    where: {
      bin_ids: { has: bin_id },
      job:     { state: { notIn: TERMINAL } },
    },
  });
  return !!routine;
}

// ─────────────────────────────────────────────────────────────────────────────
// getJobs — paginated list with optional filters
// ─────────────────────────────────────────────────────────────────────────────
export async function getJobs(
  filters: {
    job_type?:  string;
    state?:     string;
    zone_id?:   string;
    date_from?: string;
    date_to?:   string;
    page?:      number;
    limit?:     number;
  } = {},
): Promise<{ data: CollectionJob[]; total: number; page: number; limit: number }> {
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CollectionJobWhereInput = {
    ...(filters.job_type ? { job_type: filters.job_type } : {}),
    ...(filters.state ? {
      state: { in: filters.state.split(',').map((s) => s.trim()).filter(Boolean) },
    } : {}),
    ...(filters.zone_id  ? { zone_id:  parseInt(filters.zone_id, 10) } : {}),
    ...(filters.date_from || filters.date_to
      ? {
          created_at: {
            ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
            ...(filters.date_to   ? { lte: new Date(filters.date_to) }   : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.collectionJob.count({ where }),
    prisma.collectionJob.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: { emergency_details: true, routine_details: true, execution_metrics: true },
    }),
  ]);

  return { data: rows.map(rowToJob), total, page, limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// getStats — aggregate metrics for the analytics endpoint
// ─────────────────────────────────────────────────────────────────────────────
export async function getStats(
  filters: { date_from?: string; date_to?: string; zone_id?: string } = {},
): Promise<{
  total_jobs:                 number;
  emergency_jobs:             number;
  routine_jobs:               number;
  completed_jobs:             number;
  escalated_jobs:             number;
  cancelled_jobs:             number;
  completion_rate_pct:        number;
  avg_duration_minutes:       number;
  avg_bins_per_job:           number;
  avg_weight_per_job_kg:      number;
  emergency_vs_routine_ratio: number;
}> {
  const where: Prisma.CollectionJobWhereInput = {
    ...(filters.zone_id  ? { zone_id: parseInt(filters.zone_id, 10) } : {}),
    ...(filters.date_from || filters.date_to
      ? {
          created_at: {
            ...(filters.date_from ? { gte: new Date(filters.date_from) } : {}),
            ...(filters.date_to   ? { lte: new Date(filters.date_to) }   : {}),
          },
        }
      : {}),
  };

  const [total, emergency, routine, completed, escalated, cancelled] = await Promise.all([
    prisma.collectionJob.count({ where }),
    prisma.collectionJob.count({ where: { ...where, job_type: 'emergency' } }),
    prisma.collectionJob.count({ where: { ...where, job_type: 'routine'   } }),
    prisma.collectionJob.count({ where: { ...where, state: 'COMPLETED'   } }),
    prisma.collectionJob.count({ where: { ...where, state: 'ESCALATED'   } }),
    prisma.collectionJob.count({ where: { ...where, state: 'CANCELLED'   } }),
  ]);

  const metricsRows = await prisma.jobExecutionMetrics.findMany({
    where: { job: { ...where, state: 'COMPLETED' } },
  });

  const withDuration = metricsRows.filter((r) => r.actual_duration_min != null);
  const avgDuration  = withDuration.length > 0
    ? withDuration.reduce((s, r) => s + (r.actual_duration_min ?? 0), 0) / withDuration.length
    : 0;

  const withWeight  = metricsRows.filter((r) => r.actual_weight_kg != null);
  const avgWeight   = withWeight.length > 0
    ? withWeight.reduce((s, r) => s + Number(r.actual_weight_kg ?? 0), 0) / withWeight.length
    : 0;

  // avg bins — from bin_ids array length across all detail rows
  const emergencyDetails = await prisma.emergencyJobDetails.findMany({ where: { job: where } });
  const routineDetails   = await prisma.routineJobDetails.findMany({ where: { job: where } });
  const totalBinCount    = [
    ...emergencyDetails.map((r) => r.bin_ids.length),
    ...routineDetails.map((r)   => r.bin_ids.length),
  ].reduce((s, n) => s + n, 0);
  const avgBins = total > 0 ? totalBinCount / total : 0;

  return {
    total_jobs:                 total,
    emergency_jobs:             emergency,
    routine_jobs:               routine,
    completed_jobs:             completed,
    escalated_jobs:             escalated,
    cancelled_jobs:             cancelled,
    completion_rate_pct:        total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
    avg_duration_minutes:       parseFloat(avgDuration.toFixed(1)),
    avg_bins_per_job:           parseFloat(avgBins.toFixed(1)),
    avg_weight_per_job_kg:      parseFloat(avgWeight.toFixed(2)),
    emergency_vs_routine_ratio: routine > 0 ? parseFloat((emergency / routine).toFixed(2)) : emergency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// clearAll — only for tests
// ─────────────────────────────────────────────────────────────────────────────
export async function clearAll(): Promise<void> {
  // Cascades on FK — order matters
  await prisma.jobStepResult.deleteMany();
  await prisma.driverAssignmentHistory.deleteMany();
  await prisma.binCollectionRecord.deleteMany();
  await prisma.vehicleWeightLog.deleteMany();
  await prisma.jobExecutionMetrics.deleteMany();
  await prisma.jobStateTransition.deleteMany();
  await prisma.emergencyJobDetails.deleteMany();
  await prisma.routineJobDetails.deleteMany();
  await prisma.collectionJob.deleteMany();
}
