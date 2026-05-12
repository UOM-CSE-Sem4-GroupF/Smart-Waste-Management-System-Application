import { FastifyInstance } from 'fastify';
import { CollectionJob, JobCompleteRequest } from '../types';
import { getJob, getJobs, getStats, getStateHistory, getStepLog, insertJob } from '../db/queries';
import { executeEmergencyWorkflow, executeRoutineWorkflow, completeJob, cancelJob, handleWorkflowFailure } from '../core/orchestrator';

const err404 = (id: string) => ({ error: 'RESOURCE_NOT_FOUND', message: `Job ${id} not found`, timestamp: new Date().toISOString() });

// Maps internal CollectionJob → shape the dashboard list expects
function toListItem(job: CollectionJob) {
  return {
    id:                  job.job_id,
    job_type:            job.job_type,
    zone_id:             parseInt(job.zone_id, 10),
    zone_name:           `Zone ${job.zone_id}`,
    state:               job.state,
    priority:            job.job_type === 'emergency' ? 9 : 5,
    assigned_vehicle_id: job.assigned_vehicle_id  ?? null,
    assigned_driver_id:  job.assigned_driver_id   ?? null,
    clusters:            job.clusters,
    planned_weight_kg:   job.planned_weight_kg     ?? null,
    actual_weight_kg:    job.actual_weight_kg      ?? null,
    bins_total:          job.bins_to_collect.length,
    bins_collected:      0,
    bins_skipped:        0,
    created_at:          job.created_at,
    completed_at:        job.completed_at ?? null,
    duration_minutes:    job.actual_duration_min   ?? null,
  };
}

export default async function jobRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/collection-jobs/stats  — must be before /:id
  app.get('/api/v1/collection-jobs/stats', async (req) => {
    const { date_from, date_to, zone_id } = req.query as Record<string, string | undefined>;
    return getStats({ date_from, date_to, zone_id });
  });

  // GET /api/v1/collection-jobs
  app.get('/api/v1/collection-jobs', async (req) => {
    const { job_type, state, zone_id, date_from, date_to, page = '1', limit = '20' } =
      req.query as Record<string, string | undefined>;
    const result = await getJobs({
      job_type, state, zone_id, date_from, date_to,
      page:  parseInt(page  ?? '1'),
      limit: Math.min(parseInt(limit ?? '20'), 100),
    });
    return { ...result, data: result.data.map(toListItem) };
  });

  // GET /api/v1/collection-jobs/:id
  app.get<{ Params: { id: string } }>('/api/v1/collection-jobs/:id', async (req, reply) => {
    const job = await getJob(req.params.id);
    if (!job) return reply.code(404).send(err404(req.params.id));
    return {
      ...toListItem(job),
      trigger_bin_id:        job.trigger_bin_id        ?? null,
      trigger_urgency_score: job.trigger_urgency_score ?? null,
      route_plan_id:         job.route_plan_id         ?? null,
      planned_distance_km:   null,
      actual_distance_km:    job.actual_distance_km    ?? null,
      planned_duration_min:  null,
      hyperledger_tx_id:     job.hyperledger_tx_id     ?? null,
      failure_reason:        job.failure_reason        ?? null,
      escalated_at:          null,
      bin_collections:       [],
      state_history:         await getStateHistory(job.job_id),
      step_log:              await getStepLog(job.job_id),
    };
  });

  // POST /api/v1/collection-jobs/:id/cancel  — supervisor
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/v1/collection-jobs/:id/cancel',
    async (req, reply) => {
      const job = await getJob(req.params.id);
      if (!job) return reply.code(404).send(err404(req.params.id));

      if (job.state === 'IN_PROGRESS') {
        return reply.code(409).send({
          error:   'CANNOT_CANCEL_IN_PROGRESS',
          message: 'Cannot cancel a job that is currently IN_PROGRESS — driver is already collecting',
        });
      }

      const ok = await cancelJob(job, req.body?.reason ?? 'Cancelled by supervisor');
      if (!ok) {
        return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot cancel job in state ${job.state}` });
      }
      return { job_id: job.job_id, state: job.state };
    },
  );

  // POST /internal/jobs/:id/complete  — called by scheduler when collection done
  app.post<{ Params: { id: string }; Body: JobCompleteRequest }>(
    '/internal/jobs/:id/complete',
    async (req, reply) => {
      const job = await getJob(req.params.id);
      if (!job) return reply.code(404).send(err404(req.params.id));
      if (job.state !== 'IN_PROGRESS') {
        return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot complete job in state ${job.state}` });
      }
      await completeJob(job, req.body);
      return { job_id: job.job_id, state: job.state, completed_at: job.completed_at };
    },
  );

  // POST /api/v1/collection-jobs/:id/complete  — public alias (backward compat, minimal payload)
  app.post<{ Params: { id: string } }>(
    '/api/v1/collection-jobs/:id/complete',
    async (req, reply) => {
      const job = await getJob(req.params.id);
      if (!job) return reply.code(404).send(err404(req.params.id));
      if (job.state !== 'IN_PROGRESS') {
        return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot complete job in state ${job.state}` });
      }
      const synth: JobCompleteRequest = {
        job_id:             job.job_id,
        vehicle_id:         job.assigned_vehicle_id ?? '',
        driver_id:          job.assigned_driver_id  ?? '',
        bins_collected:     job.bins_to_collect.map(bin_id => ({
          bin_id, collected_at: new Date().toISOString(), fill_level_at_collection: 0, gps_lat: 0, gps_lng: 0,
        })),
        bins_skipped:       [],
        actual_weight_kg:   job.planned_weight_kg ?? 0,
        actual_distance_km: 0,
        route_gps_trail:    [],
      };
      await completeJob(job, synth);
      return { job_id: job.job_id, state: job.state, completed_at: job.completed_at };
    },
  );

  // POST /api/v1/collection-jobs  — manual trigger (demo / testing)
  app.post<{
    Body: {
      job_type?:       string;
      zone_id:         string;
      waste_category?: string;
      bin_ids?:        string[];
      urgency_score?:  number;
    };
  }>('/api/v1/collection-jobs', async (req, reply) => {
    const jt          = (req.body.job_type as 'emergency' | 'routine') ?? 'emergency';
    const waste_cat   = req.body.waste_category ?? 'general';
    const urgency     = req.body.urgency_score  ?? 85;
    const zone_id     = req.body.zone_id;
    const bin_ids     = req.body.bin_ids ?? [];

    const job = await insertJob({
      job_type:              jt,
      zone_id,
      waste_category:        waste_cat,
      trigger_urgency_score: jt === 'emergency' ? urgency : undefined,
    });

    if (jt === 'emergency') {
      const trigger_bin = bin_ids[0] ?? `MANUAL-${zone_id}`;
      executeEmergencyWorkflow(job, { bin_id: trigger_bin, urgency_score: urgency, waste_category: waste_cat, zone_id })
        .catch(e => handleWorkflowFailure(job, e));
    } else {
      executeRoutineWorkflow(job, { zone_id, bin_ids, waste_category: waste_cat })
        .catch(e => handleWorkflowFailure(job, e));
    }

    return reply.code(201).send({ job_id: job.job_id, state: job.state });
  });
}
