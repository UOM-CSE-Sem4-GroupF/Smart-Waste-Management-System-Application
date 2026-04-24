import { FastifyInstance } from 'fastify';
import { jobProgress, recordBinCollected, recordBinSkipped } from '../store';

export default async function collectionsRoutes(app: FastifyInstance) {
  // Called by Flutter app via Kong: driver marks a bin as collected
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body:   { actual_weight_kg?: number };
  }>('/api/v1/collections/:job_id/bins/:bin_id/collected', async (req, reply) => {
    const ok = recordBinCollected(req.params.job_id, req.params.bin_id, req.body.actual_weight_kg);
    if (!ok) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.job_id} not found` });
    return { success: true, timestamp: new Date().toISOString() };
  });

  // Called by Flutter app via Kong: driver skips a bin with a reason
  app.post<{
    Params: { job_id: string; bin_id: string };
    Body:   { reason: string };
  }>('/api/v1/collections/:job_id/bins/:bin_id/skip', async (req, reply) => {
    if (!req.body.reason)
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'reason is required' });
    const ok = recordBinSkipped(req.params.job_id, req.params.bin_id, req.body.reason);
    if (!ok) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.job_id} not found` });
    return { success: true, timestamp: new Date().toISOString() };
  });

  // Per-job progress (bin-by-bin status + cargo accumulation)
  app.get<{ Params: { job_id: string } }>('/api/v1/jobs/:job_id/progress', async (req, reply) => {
    const progress = jobProgress.get(req.params.job_id);
    if (!progress) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Job ${req.params.job_id} not found` });
    return progress;
  });
}
