import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

import binsRoutes         from './routes/bins';
import alertsRoutes       from './routes/alerts';
import pickupRoutesPlugin from './routes/pickup-routes';
import analyticsRoutes    from './routes/analytics';
import zonesRoutes        from './routes/zones';

async function start() {
  const app = Fastify({ logger: true });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  // Health check — used by Kong and Docker healthcheck
  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  // All data routes under /v1
  await app.register(binsRoutes,         { prefix: '/v1' });
  await app.register(alertsRoutes,       { prefix: '/v1' });
  await app.register(pickupRoutesPlugin, { prefix: '/v1' });
  await app.register(analyticsRoutes,    { prefix: '/v1' });
  await app.register(zonesRoutes,        { prefix: '/v1' });

  const PORT = Number(process.env.PORT ?? 3001);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
