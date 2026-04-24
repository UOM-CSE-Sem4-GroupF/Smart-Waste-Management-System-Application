import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import collectionJobsRoutes from './routes/collection-jobs';
import { startKafkaConsumer } from './kafka/consumer';

const SERVICE = 'workflow-orchestrator';
const VERSION = '1.0.0';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: SERVICE, message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: SERVICE, version: VERSION }));

  await app.register(collectionJobsRoutes);

  const PORT = Number(process.env.PORT ?? 3001);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  startKafkaConsumer().catch(err =>
    slog('WARN', `Kafka unavailable — emergency/routine triggers from Kafka disabled: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
