import 'dotenv/config';
import Fastify from 'fastify';
import cors    from '@fastify/cors';
import helmet  from '@fastify/helmet';
import healthRoutes from './api/healthRoutes';
import jobRoutes    from './api/jobRoutes';
import { startBinProcessedConsumer }    from './consumers/binProcessedConsumer';
import { startRoutineScheduleConsumer } from './consumers/routineScheduleConsumer';
import { startModelRetrainedConsumer }  from './consumers/modelRetrainedConsumer';

const SERVICE = 'workflow-orchestrator';
const VERSION = '2.0.0';

const slog = (level: string, msg: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: SERVICE, message: msg,
  }) + '\n');
};

async function start(): Promise<void> {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors,   { origin: '*' });

  await app.register(healthRoutes);
  await app.register(jobRoutes);

  const PORT = Number(process.env.PORT ?? 3001);
  await app.listen({ port: PORT, host: '0.0.0.0' });
  slog('INFO', `${SERVICE} v${VERSION} listening on :${PORT}`);

  // Kafka consumers are best-effort — service runs without Kafka if unavailable
  startBinProcessedConsumer()
    .catch(err => slog('WARN', `Emergency consumer offline: ${err.message}`));
  startRoutineScheduleConsumer()
    .catch(err => slog('WARN', `Routine consumer offline: ${err.message}`));
  startModelRetrainedConsumer()
    .catch(err => slog('WARN', `Model consumer offline: ${err.message}`));
}

start().catch(err => { console.error(err); process.exit(1); });
