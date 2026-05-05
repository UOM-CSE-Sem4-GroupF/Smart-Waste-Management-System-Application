import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import internalRoutes    from './routes/internal';
import collectionsRoutes from './routes/collections';
import vehiclesRoutes    from './routes/vehicles';
import driversRoutes     from './routes/drivers';
import { startKafkaConsumer } from './kafka/consumer';

const SERVICE = 'scheduler-service';
const VERSION = '1.0.0';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));

  await app.register(internalRoutes);
  await app.register(collectionsRoutes);
  await app.register(vehiclesRoutes);
  await app.register(driversRoutes);

  const PORT = Number(process.env.PORT ?? 3003);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  startKafkaConsumer().catch(err =>
    slog('WARN', `Kafka unavailable — running without live vehicle positions: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
