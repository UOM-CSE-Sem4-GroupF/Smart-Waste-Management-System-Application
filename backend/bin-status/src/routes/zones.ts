import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { store } from '../store';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Validate JWT token (simplified — in production, use @fastify/jwt)
 */
function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token && process.env.NODE_ENV === 'production') {
    reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid JWT token',
    });
    return false;
  }
  return true;
}

export default async function zonesRoutes(app: FastifyInstance) {
  // List all zones with summary stats
  app.get('/api/v1/zones', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const bins = store.getAllBins();
      const zoneIds = [...new Set(bins.map((b) => b.zone_id))];

      const data = zoneIds.map((zone_id) => {
        const zBins = bins.filter((b) => b.zone_id === zone_id);
        const avgFill = zBins.reduce((s, b) => s + b.fill_level_pct, 0) / zBins.length;
        const totalWeight = zBins.reduce((s, b) => s + b.estimated_weight_kg, 0);
        const urgentCount = zBins.filter((b) => b.urgency_score >= 80).length;
        const criticalCount = zBins.filter((b) => b.status === 'critical').length;

        return {
          zone_id,
          zone_name: `Zone ${zone_id}`,
          bin_count: zBins.length,
          avg_fill_pct: parseFloat(avgFill.toFixed(1)),
          total_estimated_weight_kg: parseFloat(totalWeight.toFixed(2)),
          urgent_bins: urgentCount,
          critical_bins: criticalCount,
          active_jobs: store.getActiveJobsCountForZone(Number(zone_id)),
        };
      });

      logger.debug({ zone_count: data.length }, 'GET /api/v1/zones');
      return { data };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch zones',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch zones',
      });
    }
  });
}
