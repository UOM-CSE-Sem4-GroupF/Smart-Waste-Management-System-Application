import type { FastifyPluginAsync } from 'fastify';
import { zones } from '../data/store';

const zonesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/zones', async () => zones);

  app.get<{ Params: { id: string } }>('/zones/:id', async (req, reply) => {
    const zone = zones.find(z => z.id === req.params.id);
    if (!zone) return reply.status(404).send({ error: 'Zone not found' });
    return zone;
  });
};

export default zonesRoutes;