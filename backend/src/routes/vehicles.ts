import type { FastifyPluginAsync } from 'fastify';
import { vehicles } from '../data/store';

const vehiclesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/vehicles/active', async () =>
    vehicles.filter(v => Date.now() - v.lastUpdate < 5 * 60 * 1000)
  );
};

export default vehiclesRoutes;
