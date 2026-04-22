import type { FastifyPluginAsync } from 'fastify';
import { getAnalytics } from '../data/store';

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/analytics', async () => getAnalytics());
};

export default analyticsRoutes;