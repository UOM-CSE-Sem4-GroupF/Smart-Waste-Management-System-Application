import { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status:          'ok',
    service:         'workflow-orchestrator',
    version:         '2.0.0',
    uptime_seconds:  Math.floor(process.uptime()),
    timestamp:       new Date().toISOString(),
  }));
}
