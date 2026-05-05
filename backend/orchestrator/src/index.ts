import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jobRoutes from './api/jobRoutes';
import healthRoutes from './api/healthRoutes';
import { startBinProcessedConsumer } from './consumers/binProcessedConsumer';
import { startRoutineScheduleConsumer } from './consumers/routineScheduleConsumer';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'workflow-orchestrator', message: msg }) + '\n');

async function start() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*' });
  await app.register(healthRoutes);
  await app.register(jobRoutes);

  const PORT = Number(process.env.PORT ?? 3001);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `Listening on :${PORT}`);

  startBinProcessedConsumer().catch(err =>
    slog('WARN', `Emergency consumer unavailable: ${err.message}`),
  );
  startRoutineScheduleConsumer().catch(err =>
    slog('WARN', `Routine consumer unavailable: ${err.message}`),
  );
}

start().catch(err => { console.error(err); process.exit(1); });
