import type { FastifyPluginAsync } from 'fastify';
import { bins } from '../data/store';

const binsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/bins', async () => bins);

  app.get<{ Params: { id: string } }>('/bins/:id', async (req, reply) => {
    const bin = bins.find(b => b.id === req.params.id);
    if (!bin) return reply.status(404).send({ error: 'Bin not found' });
    return bin;
  });
};

export default binsRoutes;