import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import internalRoutes  from './api/internalRoutes';
import collectionRoutes from './api/collectionRoutes';
import readRoutes       from './api/readRoutes';
import { startVehicleLocationConsumer }  from './consumers/vehicleLocationConsumer';
import { startVehicleDeviationConsumer } from './consumers/vehicleDeviationConsumer';

const SERVICE = 'scheduler-service';
const VERSION = '1.0.0';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors,   { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));

  await app.register(internalRoutes);
  await app.register(collectionRoutes);
  await app.register(readRoutes);

  const PORT = Number(process.env.PORT ?? 3003);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  startVehicleLocationConsumer().catch(err =>
    slog('WARN', `Vehicle location consumer unavailable: ${err.message}`),
  );
  startVehicleDeviationConsumer().catch(err =>
    slog('WARN', `Vehicle deviation consumer unavailable: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
