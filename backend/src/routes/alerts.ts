import type { FastifyPluginAsync } from 'fastify';
import { alerts } from '../data/store';

const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/alerts', async () => alerts);

  app.patch<{ Params: { id: string } }>('/alerts/:id/read', async (req, reply) => {
    const alert = alerts.find(a => a.id === req.params.id);
    if (!alert) return reply.status(404).send({ error: 'Alert not found' });
    alert.read = true;
    return alert;
  });

  app.patch('/alerts/read-all', async () => {
    alerts.forEach(a => { a.read = true; });
    return { updated: alerts.length };
  });
};

export default alertsRoutes;