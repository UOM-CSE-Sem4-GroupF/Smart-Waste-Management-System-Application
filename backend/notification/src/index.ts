import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server as SocketServer } from 'socket.io';
import internalRoutes from './routes/internal';
import { setSocketServer } from './socket';
import { startKafkaConsumers } from './kafka/consumer';
import { verifyToken } from './auth';

const SERVICE  = 'notification-service';
const VERSION  = '1.0.0';
const SKIP_AUTH = process.env.SKIP_AUTH === 'true' || process.env.NODE_ENV === 'development';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg, ...extra }) + '\n');

async function attachRedisAdapter(io: SocketServer): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { createClient }  = await import('redis');
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    slog('INFO', 'Redis Socket.IO adapter attached');
  } catch (e) {
    slog('CRITICAL', `Redis adapter failed — running single-pod mode: ${(e as Error).message}`);
  }
}

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));
  await app.register(internalRoutes);

  const PORT = Number(process.env.PORT ?? 3004);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  const io = new SocketServer(app.server, {
    cors:          { origin: '*' },
    path:          '/socket.io',
    transports:    ['websocket', 'polling'],
    pingTimeout:   20000,
    pingInterval:  10000,
  });

  await attachRedisAdapter(io);
  setSocketServer(io);

  io.use(async (socket, next) => {
    if (SKIP_AUTH) {
      socket.data.role     = socket.handshake.auth?.role      ?? 'viewer';
      socket.data.zoneId   = socket.handshake.auth?.zone_id   ?? null;
      socket.data.driverId = socket.handshake.auth?.driver_id ?? null;
      return next();
    }

    const token = socket.handshake.auth?.token
      ?? (socket.handshake.headers.authorization as string | undefined)?.replace('Bearer ', '');

    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded       = await verifyToken(token);
      socket.data.role     = decoded.role;
      socket.data.zoneId   = decoded.zoneId;
      socket.data.driverId = decoded.driverId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, zoneId, driverId } = socket.data as {
      role: string; zoneId?: number; driverId?: string;
    };
    slog('INFO', `Client connected: ${socket.id}`, { role });

    switch (role) {
      case 'supervisor':
        socket.join('dashboard-all');
        if (zoneId != null) socket.join(`dashboard-zone-${zoneId}`);
        socket.join('alerts-all');
        break;

      case 'fleet-operator':
        socket.join('dashboard-all');
        socket.join('fleet-ops');
        socket.join('alerts-all');
        break;

      case 'driver':
        if (driverId) socket.join(`driver-${driverId}`);
        break;

      default:
        socket.join('dashboard-all');
        break;
    }

    socket.on('disconnect', () => slog('INFO', `Client disconnected: ${socket.id}`));
  });

  startKafkaConsumers().catch(err =>
    slog('WARN', `Kafka unavailable — live updates from Kafka disabled: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
