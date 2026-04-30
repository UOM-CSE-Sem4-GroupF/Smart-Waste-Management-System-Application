import { FastifyInstance } from 'fastify';
import { JobCompleteRequest } from '../types';
import { getJob, getJobs, getStats, getStateHistory, getStepLog, insertJob } from '../db/queries';
import { executeEmergencyWorkflow, executeRoutineWorkflow, completeJob, cancelJob, handleWorkflowFailure } from '../core/orchestrator';

const err404 = (id: string) => ({ error: 'RESOURCE_NOT_FOUND', message: `Job ${id} not found`, timestamp: new Date().toISOString() });

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
    return getJobs({
      job_type, state, zone_id, date_from, date_to,
      page:  parseInt(page  ?? '1'),
      limit: Math.min(parseInt(limit ?? '20'), 100),
    });
  });

  // GET /api/v1/collection-jobs/:id
  app.get<{ Params: { id: string } }>('/api/v1/collection-jobs/:id', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send(err404(req.params.id));
    return {
      ...job,
      state_history: getStateHistory(job.job_id),
      step_log:      getStepLog(job.job_id),
    };
  });

  // POST /api/v1/collection-jobs/:id/cancel  — supervisor
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/v1/collection-jobs/:id/cancel',
    async (req, reply) => {
      const job = getJob(req.params.id);
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
      const job = getJob(req.params.id);
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
      const job = getJob(req.params.id);
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

    const job = insertJob({
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
