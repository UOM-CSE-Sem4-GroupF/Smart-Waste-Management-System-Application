import { FastifyInstance } from 'fastify';
import * as db from '../db/queries';
import { handleJobCompletion, cancelJobById } from '../core/orchestrator';
import { JobCompleteRequest } from '../types';

export default async function jobRoutes(app: FastifyInstance) {
  app.get('/api/v1/collection-jobs', async (req) => {
    const q = req.query as Record<string, string>;
    return db.listJobs({
      job_type:  q.job_type,
      state:     q.state,
      zone_id:   q.zone_id   ? Number(q.zone_id)        : undefined,
      date_from: q.date_from,
      date_to:   q.date_to,
      page:      q.page      ? parseInt(q.page,  10)    : undefined,
      limit:     q.limit     ? parseInt(q.limit, 10)    : undefined,
    });
  });

  // Must be registered before /:job_id to avoid "stats" being matched as a job ID
  app.get('/api/v1/collection-jobs/stats', async (req) => {
    const q = req.query as Record<string, string>;
    return db.getStats({
      zone_id:   q.zone_id   ? Number(q.zone_id) : undefined,
      date_from: q.date_from,
      date_to:   q.date_to,
    });
  });

  app.get<{ Params: { job_id: string } }>('/api/v1/collection-jobs/:job_id', async (req, reply) => {
    const detail = db.getJobDetail(req.params.job_id);
    if (!detail) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.job_id} not found` });
    return detail;
  });

  app.post<{ Params: { job_id: string }; Body: { reason?: string } }>(
    '/api/v1/collection-jobs/:job_id/cancel',
    async (req, reply) => {
      try {
        await cancelJobById(req.params.job_id, req.body?.reason ?? 'Cancelled by supervisor');
        const job = db.getJob(req.params.job_id)!;
        return { job_id: job.id, state: job.state };
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('not found')) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: msg });
        return reply.code(409).send({ error: 'INVALID_STATE', message: msg });
      }
    },
  );

  app.post<{ Params: { job_id: string }; Body: JobCompleteRequest }>(
    '/internal/jobs/:job_id/complete',
    async (req, reply) => {
      try {
        await handleJobCompletion(req.params.job_id, req.body);
        const job = db.getJob(req.params.job_id)!;
        return { job_id: job.id, state: job.state };
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('not found')) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: msg });
        return reply.code(500).send({ error: 'WORKFLOW_ERROR', message: msg });
      }
    },
  );
}
