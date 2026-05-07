import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status:          'ok',
    service:         'workflow-orchestrator',
    version:         '2.0.0',
    uptime_seconds:  Math.floor(process.uptime()),
    timestamp:       new Date().toISOString(),
  }));

  app.get('/ready', async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', service: 'workflow-orchestrator', database: 'connected' };
    } catch {
      reply.code(503);
      return { status: 'not_ready', service: 'workflow-orchestrator', database: 'disconnected' };
    }
  });
}
