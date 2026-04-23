import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server as SocketServer } from 'socket.io';

import binsRoutes         from './routes/bins';
import alertsRoutes       from './routes/alerts';
import pickupRoutesPlugin from './routes/pickup-routes';
import analyticsRoutes    from './routes/analytics';
import zonesRoutes        from './routes/zones';
import vehiclesRoutes     from './routes/vehicles';
import { startKafkaConsumer } from './kafka/consumer';
import { storeEvents } from './data/store';

async function start() {
  const app = Fastify({ logger: true });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

  await app.register(binsRoutes,         { prefix: '/v1' });
  await app.register(alertsRoutes,       { prefix: '/v1' });
  await app.register(pickupRoutesPlugin, { prefix: '/v1' });
  await app.register(analyticsRoutes,    { prefix: '/v1' });
  await app.register(zonesRoutes,        { prefix: '/v1' });
  await app.register(vehiclesRoutes,     { prefix: '/v1' });

  const PORT = Number(process.env.PORT ?? 3001);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Attach Socket.IO to the same HTTP server
  const io = new SocketServer(app.server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    app.log.info(`Socket.IO client connected: ${socket.id}`);
    socket.on('disconnect', () => app.log.info(`Socket.IO client disconnected: ${socket.id}`));
  });

  // Forward store mutations to all connected Socket.IO clients
  storeEvents.on('bin:update',       (bin)     => io.emit('bin:update',       bin));
  storeEvents.on('vehicle:position', (vehicle) => io.emit('vehicle:position', vehicle));

  const log = {
    info:  (s: string) => app.log.info(s),
    warn:  (s: string) => app.log.warn(s),
    error: (s: string) => app.log.error(s),
  };
  startKafkaConsumer(log).catch(err => {
    app.log.warn(`Kafka consumer failed to start: ${err.message} — running without live data`);
  });
}

start();
