import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server as SocketServer } from 'socket.io';
import binsRoutes     from './routes/bins';
import zonesRoutes    from './routes/zones';
import internalRoutes from './routes/internal';
import { setBinSocketServer } from './socket';
import { startKafkaConsumer } from './kafka/consumer';

const SERVICE = 'bin-status-service';
const VERSION = '1.0.0';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));

  await app.register(binsRoutes);
  await app.register(zonesRoutes);
  await app.register(internalRoutes);

  const PORT = Number(process.env.PORT ?? 3002);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  const io = new SocketServer(app.server, {
    cors:          { origin: '*' },
    path:          '/socket.io',
    transports:    ['websocket', 'polling'],
    pingTimeout:   20000,
    pingInterval:  10000,
  });

  setBinSocketServer(io);

  io.on('connection', (socket) => {
    slog('INFO', `Client connected: ${socket.id}`);
    socket.on('join', (rooms: string[]) => {
      if (!Array.isArray(rooms)) return;
      rooms.forEach(room => socket.join(room));
      slog('INFO', `${socket.id} joined rooms: ${rooms.join(', ')}`);
    });
    socket.on('leave', (rooms: string[]) => {
      if (!Array.isArray(rooms)) return;
      rooms.forEach(room => socket.leave(room));
    });
    socket.on('disconnect', () => slog('INFO', `Client disconnected: ${socket.id}`));
  });

  startKafkaConsumer().catch(err =>
    slog('WARN', `Kafka unavailable — running without live bin data: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
