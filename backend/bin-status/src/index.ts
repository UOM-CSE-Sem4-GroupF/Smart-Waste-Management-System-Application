import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import pino from 'pino';
import { Server as SocketServer } from 'socket.io';
import binsRoutes from './routes/bins';
import zonesRoutes from './routes/zones';
import internalRoutes from './routes/internal';
import { setBinSocketServer } from './socket';
import { startKafkaConsumer } from './kafka/consumer';

const SERVICE = 'bin-status-service';
const VERSION = '1.0.0';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

async function start() {
  const app = Fastify({
    logger: false, // We'll use pino directly
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE,
    version: VERSION,
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await app.register(binsRoutes);
  await app.register(zonesRoutes);
  await app.register(internalRoutes);

  // Start server
  const PORT = Number(process.env.PORT ?? 3002);
  const HOST = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port: PORT, host: HOST });
  logger.info(`${SERVICE} v${VERSION} listening on ${HOST}:${PORT}`);

  // Setup Socket.IO
  const io = new SocketServer(app.server, {
    cors: { origin: '*' },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  setBinSocketServer(io);

  io.on('connection', (socket) => {
    logger.debug({ client_id: socket.id }, 'Socket.IO client connected');

    socket.on('join', (rooms: string[]) => {
      if (!Array.isArray(rooms)) return;
      rooms.forEach((room) => socket.join(room));
      logger.debug({ client_id: socket.id, rooms }, 'Socket.IO client joined rooms');
    });

    socket.on('leave', (rooms: string[]) => {
      if (!Array.isArray(rooms)) return;
      rooms.forEach((room) => socket.leave(room));
      logger.debug({ client_id: socket.id, rooms }, 'Socket.IO client left rooms');
    });

    socket.on('disconnect', () => {
      logger.debug({ client_id: socket.id }, 'Socket.IO client disconnected');
    });

    socket.on('error', (error) => {
      logger.error({ client_id: socket.id, error }, 'Socket.IO error');
    });
  });

  // Start Kafka consumer
  try {
    await startKafkaConsumer();
    logger.info('Kafka consumers started successfully');
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Kafka consumer failed to start — running without live bin data',
    );
  }
}

start().catch((error) => {
  logger.error(error, 'Failed to start service');
  process.exit(1);
});
