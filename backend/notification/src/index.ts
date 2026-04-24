import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server as SocketServer } from 'socket.io';
import internalRoutes from './routes/internal';
import { setSocketServer } from './socket';
import { startKafkaConsumer } from './kafka/consumer';

const SERVICE = 'notification-service';
const VERSION = '1.0.0';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));

  await app.register(internalRoutes);

  const PORT = Number(process.env.PORT ?? 3004);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  // Attach Socket.IO to the same Fastify HTTP server
  const io = new SocketServer(app.server, {
    cors:            { origin: '*' },
    path:            '/socket.io',
    transports:      ['websocket', 'polling'],
    pingTimeout:     20000,
    pingInterval:    10000,
  });

  setSocketServer(io);

  io.on('connection', (socket) => {
    slog('INFO', `Client connected: ${socket.id}`);

    // Clients call socket.emit('join', ['dashboard-all', 'fleet-ops']) to subscribe to rooms
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
    slog('WARN', `Kafka unavailable — Socket.IO alerts from Kafka disabled: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
