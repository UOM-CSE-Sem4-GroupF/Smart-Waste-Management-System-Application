import { FastifyInstance } from 'fastify';
import { vehicles } from '../store';

export default async function vehiclesRoutes(app: FastifyInstance) {
  app.get('/api/v1/vehicles', async () => {
    return { data: [...vehicles.values()] };
  });

  app.get('/api/v1/vehicles/active', async () => {
    return { data: [...vehicles.values()].filter(v => !v.available) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/vehicles/:id', async (req, reply) => {
    const v = vehicles.get(req.params.id);
    if (!v) return reply.code(404).send({ error: 'RESOURCE_NOT_FOUND', message: `Vehicle ${req.params.id} not found` });
    return v;
  });
}
