import { FastifyInstance } from 'fastify';
import { getJob, getAllJobs, createJob } from '../store';
import { acceptJob, completeJob, cancelJob, runStateMachine } from '../state-machine/machine';

export default async function collectionJobsRoutes(app: FastifyInstance) {
  // List all collection jobs (paginated, filterable by state)
  app.get('/api/v1/collection-jobs', async (req) => {
    const { state, page = '1', limit = '50' } = req.query as Record<string, string>;
    return getAllJobs({ state, page: parseInt(page), limit: parseInt(limit) });
  });

  // Full job detail including state history and step results
  app.get<{ Params: { id: string } }>('/api/v1/collection-jobs/:id', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.id} not found`, timestamp: new Date().toISOString() });
    return job;
  });

  // Driver accepts the job (Flutter app → Kong → here)
  app.post<{ Params: { id: string } }>('/api/v1/collection-jobs/:id/accept', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.id} not found` });
    const ok = await acceptJob(job);
    if (!ok) return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot accept job in state ${job.state}` });
    return { job_id: job.job_id, state: job.state };
  });

  // Supervisor cancels the job (dashboard → Kong → here)
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/api/v1/collection-jobs/:id/cancel', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.id} not found` });
    const ok = await cancelJob(job, req.body.reason ?? 'Cancelled by supervisor');
    if (!ok) return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot cancel job in state ${job.state}` });
    return { job_id: job.job_id, state: job.state };
  });

  // Driver marks the full job as complete — all bins done (Flutter app → Kong → here)
  app.post<{ Params: { id: string } }>('/api/v1/collection-jobs/:id/complete', async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.id} not found` });
    const ok = await completeJob(job);
    if (!ok) return reply.code(409).send({ error: 'INVALID_STATE', message: `Cannot complete job in state ${job.state}` });
    return { job_id: job.job_id, state: job.state, completed_at: job.completed_at };
  });

  // Manually trigger a job (for testing / demo purposes)
  app.post<{
    Body: {
      job_type?:      string;
      zone_id:        string;
      waste_category?: string;
      bin_ids?:        string[];
      urgency_score?:  number;
    };
  }>('/api/v1/collection-jobs', async (req, reply) => {
    const job = createJob({
      job_type:       (req.body.job_type as 'emergency' | 'routine') ?? 'emergency',
      zone_id:        req.body.zone_id,
      waste_category: req.body.waste_category ?? 'general',
      bin_ids:        req.body.bin_ids ?? [],
      urgency_score:  req.body.urgency_score,
    });
    runStateMachine(job).catch(console.error);
    return reply.code(201).send({ job_id: job.job_id, state: job.state });
  });
}
