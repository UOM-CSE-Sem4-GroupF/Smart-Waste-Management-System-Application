import { FastifyInstance } from 'fastify';
import { DispatchRequest } from '../types';
import { handleDispatch } from '../dispatch/dispatchHandler';
import { releaseJob } from '../db/queries';

export default async function internalRoutes(app: FastifyInstance) {
  app.post<{ Body: DispatchRequest }>('/internal/scheduler/dispatch', async (req, reply) => {
    const result = await handleDispatch(req.body);
    if (!result.success) {
      return reply.code(409).send({ error: result.reason, message: result.reason });
    }
    return result;
  });

  app.post<{ Body: { job_id: string } }>('/internal/scheduler/release', async (req) => {
    releaseJob(req.body.job_id);
    return { released: true, job_id: req.body.job_id };
  });
}
