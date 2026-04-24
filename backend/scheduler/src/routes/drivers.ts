import { FastifyInstance } from 'fastify';
import { drivers } from '../store';

export default async function driversRoutes(app: FastifyInstance) {
  app.get('/api/v1/drivers', async () => {
    return { data: [...drivers.values()] };
  });

  app.get('/api/v1/drivers/available', async () => {
    return { data: [...drivers.values()].filter(d => d.available) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/drivers/:id', async (req, reply) => {
    const d = drivers.get(req.params.id);
    if (!d) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Driver ${req.params.id} not found` });
    return d;
  });
}
