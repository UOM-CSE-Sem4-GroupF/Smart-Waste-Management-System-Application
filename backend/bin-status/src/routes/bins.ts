import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { store } from '../store';
import { BinDetailResponse, BinHistoryResponse, ClusterDetailResponse, ZoneSummaryResponse } from '../types';
import { AVG_KG_PER_LITRE } from '../rules/weightCalculator';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Validate JWT token (simplified — in production, use @fastify/jwt)
 */
function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  // Bypassed for development/testing
  return true;
}

export default async function binsRoutes(app: FastifyInstance) {
  // =========================================================================
  // GET /api/v1/bins
  // =========================================================================
  app.get<{
    Querystring: {
      zone_id?: string;
      status?: string;
      waste_category?: string;
      cluster_id?: string;
      page?: string;
      limit?: string;
    };
  }>('/api/v1/bins', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const { zone_id, status, waste_category, cluster_id, page = '1', limit = '50' } = req.query;

      let bins = store.getAllBins();

      // Apply filters
      if (zone_id) {
        bins = bins.filter((b) => b.zone_id === String(zone_id));
      }
      if (status) {
        bins = bins.filter((b) => b.status === status);
      }
      if (waste_category) {
        bins = bins.filter((b) => b.waste_category === waste_category);
      }
      if (cluster_id) {
        bins = bins.filter((b) => b.cluster_id === cluster_id);
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const total = bins.length;
      const start = (pageNum - 1) * limitNum;
      const end = start + limitNum;

      const paginatedBins = bins.slice(start, end).map((b) => ({
        bin_id: b.bin_id,
        cluster_id: b.cluster_id || 'CLUSTER-001',
        cluster_name: b.cluster_name || 'Main Depot',
        zone_id: Number(b.zone_id),
        zone_name: `Zone ${b.zone_id}`,
        lat: b.lat,
        lng: b.lng,
        address: 'Main Waste Center',
        fill_level_pct: b.fill_level_pct,
        status: b.status,
        urgency_score: b.urgency_score,
        estimated_weight_kg: b.estimated_weight_kg,
        waste_category: b.waste_category,
        waste_category_colour: '#FF5733',
        predicted_full_at: b.predicted_full_at || null,
        battery_level_pct: b.battery_level_pct || 100,
        last_reading_at: b.last_reading_at,
        last_collected_at: b.last_collected_at || null,
        has_active_job: b.has_active_job || false,
      }));

      logger.debug({ total, page: pageNum, limit: limitNum }, 'GET /api/v1/bins');
      return {
        data: paginatedBins,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch bins',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch bins',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/bins/anomalies
  // =========================================================================
  app.get('/api/v1/bins/anomalies', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const LOW_BATTERY_THRESHOLD = 20;
      const allBins = store.getAllBins();

      const anomalousBins = allBins
        .filter((b) => {
          const isOffline    = b.status === 'offline';
          const isCritical   = b.status === 'critical';
          const isUrgent     = b.status === 'urgent';
          const isLowBattery = b.battery_level_pct != null && b.battery_level_pct < LOW_BATTERY_THRESHOLD;
          return isOffline || isCritical || isUrgent || isLowBattery;
        })
        .map((b) => {
          const anomaly_types: string[] = [];
          if (b.status === 'offline') anomaly_types.push('offline');
          if (b.status === 'critical') anomaly_types.push('critical_fill');
          if (b.status === 'urgent') anomaly_types.push('urgent_fill');
          if (b.battery_level_pct != null && b.battery_level_pct < LOW_BATTERY_THRESHOLD) {
            anomaly_types.push('low_battery');
          }
          return {
            bin_id:                b.bin_id,
            cluster_id:            b.cluster_id    ?? null,
            cluster_name:          b.cluster_name  ?? null,
            zone_id:               Number(b.zone_id),
            waste_category:        b.waste_category,
            waste_category_colour: b.waste_category_colour ?? '#808080',
            anomaly_types,
            status:                b.status,
            fill_level_pct:        b.fill_level_pct,
            battery_level_pct:     b.battery_level_pct ?? null,
            urgency_score:         b.urgency_score,
            last_reading_at:       b.last_reading_at,
          };
        })
        .sort((a, b) => {
          const priority: Record<string, number> = { offline: 0, critical_fill: 1, urgent_fill: 2, low_battery: 3 };
          const aPri = Math.min(...a.anomaly_types.map((t) => priority[t] ?? 99));
          const bPri = Math.min(...b.anomaly_types.map((t) => priority[t] ?? 99));
          return aPri !== bPri ? aPri - bPri : b.urgency_score - a.urgency_score;
        });

      const summary = {
        total:         anomalousBins.length,
        offline:       anomalousBins.filter((b) => b.anomaly_types.includes('offline')).length,
        critical_fill: anomalousBins.filter((b) => b.anomaly_types.includes('critical_fill')).length,
        urgent_fill:   anomalousBins.filter((b) => b.anomaly_types.includes('urgent_fill')).length,
        low_battery:   anomalousBins.filter((b) => b.anomaly_types.includes('low_battery')).length,
      };

      logger.debug({ total: summary.total }, 'GET /api/v1/bins/anomalies');
      return { data: { summary, bins: anomalousBins } };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to fetch anomalies',
      );
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch anomalies' });
    }
  });

  // =========================================================================
  // GET /api/v1/bins/:bin_id
  // =========================================================================
  app.get<{ Params: { bin_id: string } }>('/api/v1/bins/:bin_id', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const bin = store.getBin(req.params.bin_id);
      if (!bin) {
        return reply.code(404).send({
          error: 'RESOURCE_NOT_FOUND',
          message: `Bin ${req.params.bin_id} not found`,
        });
      }

      const response: BinDetailResponse = {
        ...bin,
        cluster_id: bin.cluster_id || 'CLUSTER-001',
        cluster_name: bin.cluster_name || 'Main Depot',
        waste_category_colour: '#FF5733',
        recent_collections: store.getBinHistory(bin.bin_id).slice(-10).map((h) => ({
          job_id: 'JOB-' + Math.random().toString(36).substr(2, 9),
          collected_at: h.last_collected_at || new Date().toISOString(),
          driver_id: 'DRIVER-001',
          fill_level_at_collection: h.fill_level_pct,
          actual_weight_kg: null,
          job_type: h.urgency_score >= 80 ? 'emergency' : 'routine',
        })),
      };

      logger.debug({ bin_id: req.params.bin_id }, 'GET /api/v1/bins/:bin_id');
      return response;
    } catch (error) {
      logger.error(
        {
          bin_id: req.params.bin_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch bin details',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch bin details',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/bins/:bin_id/history
  // =========================================================================
  app.get<{
    Params: { bin_id: string };
    Querystring: {
      from?: string;
      to?: string;
      interval?: string;
    };
  }>('/api/v1/bins/:bin_id/history', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const bin = store.getBin(req.params.bin_id);
      if (!bin) {
        return reply.code(404).send({
          error: 'RESOURCE_NOT_FOUND',
          message: `Bin ${req.params.bin_id} not found`,
        });
      }

      const { from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), to = new Date().toISOString(), interval = '1h' } = req.query;

      // In production, query InfluxDB
      // For now, return mock data from history
      const history = store.getBinHistory(req.params.bin_id);

      const response: BinHistoryResponse = {
        bin_id: req.params.bin_id,
        from,
        to,
        interval,
        series: history.map((h) => ({
          timestamp: h.last_reading_at,
          fill_level_pct: h.fill_level_pct,
          urgency_score: h.urgency_score,
          estimated_weight_kg: h.estimated_weight_kg,
        })),
        collection_events: history
          .filter((h) => h.last_collected_at)
          .map((h) => ({
            collected_at: h.last_collected_at!,
            fill_level_at_collection: h.fill_level_pct,
          })),
      };

      logger.debug({ bin_id: req.params.bin_id }, 'GET /api/v1/bins/:bin_id/history');
      return response;
    } catch (error) {
      logger.error(
        {
          bin_id: req.params.bin_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch bin history',
      );
      return reply.code(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'InfluxDB unavailable — history data temporarily unavailable',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/clusters/:cluster_id
  // =========================================================================
  app.get<{ Params: { cluster_id: string } }>('/api/v1/clusters/:cluster_id', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const allBins = store.getAllBins();
      const clusterBins = allBins.filter((b) => b.cluster_id === req.params.cluster_id || !b.cluster_id);

      if (clusterBins.length === 0) {
        return reply.code(404).send({
          error: 'CLUSTER_NOT_FOUND',
          message: `Cluster ${req.params.cluster_id} not found`,
        });
      }

      // Calculate summary
      let urgent_bins = 0;
      let critical_bins = 0;
      let total_weight = 0;
      let highest_urgency = 0;

      clusterBins.forEach((b) => {
        if (b.status === 'urgent') urgent_bins++;
        if (b.status === 'critical') critical_bins++;
        total_weight += b.estimated_weight_kg;
        highest_urgency = Math.max(highest_urgency, b.urgency_score);
      });

      const response: ClusterDetailResponse = {
        cluster_id: req.params.cluster_id,
        cluster_name: 'Main Depot',
        zone_id: 1,
        zone_name: 'Zone 1',
        lat: 6.9271,
        lng: 79.8612,
        address: 'Main Waste Management Center',
        bins: clusterBins.map((b) => ({
          bin_id: b.bin_id,
          waste_category: b.waste_category,
          waste_category_colour: '#FF5733',
          fill_level_pct: b.fill_level_pct,
          status: b.status,
          urgency_score: b.urgency_score,
          estimated_weight_kg: b.estimated_weight_kg,
          predicted_full_at: b.predicted_full_at || null,
        })),
        summary: {
          total_bins: clusterBins.length,
          urgent_bins,
          critical_bins,
          total_weight_kg: parseFloat(total_weight.toFixed(2)),
          highest_urgency_score: highest_urgency,
          has_active_job: store.getActiveJobsCountForZone(1) > 0,
          active_job_id: null,
        },
      };

      logger.debug({ cluster_id: req.params.cluster_id }, 'GET /api/v1/clusters/:cluster_id');
      return response;
    } catch (error) {
      logger.error(
        {
          cluster_id: req.params.cluster_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch cluster details',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch cluster details',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/zones/:zone_id/summary
  // =========================================================================
  app.get<{ Params: { zone_id: string } }>('/api/v1/zones/:zone_id/summary', async (req, reply) => {
    if (!requireAuth(req, reply)) return;

    try {
      const zone_id = Number(req.params.zone_id);
      const zoneBins = store.getBinsByZone(zone_id);

      if (zoneBins.length === 0) {
        return reply.code(404).send({
          error: 'ZONE_NOT_FOUND',
          message: `Zone ${zone_id} not found`,
        });
      }

      // Build status breakdown
      const statusBreakdown = {
        normal: 0,
        monitor: 0,
        urgent: 0,
        critical: 0,
        offline: 0,
      };

      zoneBins.forEach((b) => {
        if (statusBreakdown.hasOwnProperty(b.status)) {
          statusBreakdown[b.status as keyof typeof statusBreakdown]++;
        }
      });

      // Build category breakdown
      const categoryMap = new Map<string, any>();
      zoneBins.forEach((b) => {
        if (!categoryMap.has(b.waste_category)) {
          categoryMap.set(b.waste_category, {
            total_bins: 0,
            total_weight_kg: 0,
            urgent_count: 0,
            avg_fill_pct: 0,
          });
        }
        const entry = categoryMap.get(b.waste_category);
        entry.total_bins++;
        entry.total_weight_kg += b.estimated_weight_kg;
        if (b.urgency_score >= 80) entry.urgent_count++;
        entry.avg_fill_pct += b.fill_level_pct;
      });

      // Calculate averages
      for (const entry of categoryMap.values()) {
        entry.avg_fill_pct = parseFloat((entry.avg_fill_pct / entry.total_bins).toFixed(2));
        entry.total_weight_kg = parseFloat(entry.total_weight_kg.toFixed(2));
      }

      const category_breakdown = Object.fromEntries(categoryMap);

      const total_weight = zoneBins.reduce((sum, b) => sum + b.estimated_weight_kg, 0);

      const response: ZoneSummaryResponse = {
        zone_id,
        zone_name: `Zone ${zone_id}`,
        total_bins: zoneBins.length,
        total_clusters: new Set(zoneBins.map((b) => b.cluster_id)).size,
        status_breakdown: statusBreakdown,
        category_breakdown,
        total_estimated_weight_kg: parseFloat(total_weight.toFixed(2)),
        active_jobs_count: store.getActiveJobsCountForZone(zone_id),
        last_updated: new Date().toISOString(),
      };

      logger.debug({ zone_id }, 'GET /api/v1/zones/:zone_id/summary');
      return response;
    } catch (error) {
      logger.error(
        {
          zone_id: req.params.zone_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch zone summary',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch zone summary',
      });
    }
  });
}
