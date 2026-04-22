import type { FastifyPluginAsync } from 'fastify';
import { pickupRoutes } from '../data/store';

const pickupRoutesPlugin: FastifyPluginAsync = async (app) => {
  app.get('/pickup-routes', async () => pickupRoutes);

  app.get<{ Params: { id: string } }>('/pickup-routes/:id', async (req, reply) => {
    const route = pickupRoutes.find(r => r.id === req.params.id);
    if (!route) return reply.status(404).send({ error: 'Route not found' });
    return route;
  });
};

export default pickupRoutesPlugin;