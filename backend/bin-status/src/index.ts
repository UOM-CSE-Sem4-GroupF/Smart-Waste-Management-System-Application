import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import binsRoutes     from './routes/bins';
import zonesRoutes    from './routes/zones';
import internalRoutes from './routes/internal';
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

  startKafkaConsumer().catch(err =>
    slog('WARN', `Kafka unavailable — running without live bin data: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
