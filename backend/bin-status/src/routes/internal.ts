import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { store } from '../store';
import { ClusterSnapshot, BinState } from '../types';
import { AVG_KG_PER_LITRE } from '../rules/weightCalculator';
import { publishToDashboard } from '../publishers/dashboardPublisher';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Internal API for orchestrator (not exposed via Kong)
 * All routes require X-Service-Name header for basic auth
 */

function validateServiceHeader(req: FastifyRequest, reply: FastifyReply): boolean {
  const serviceName = req.headers['x-service-name'];
  if (serviceName !== 'workflow-orchestrator' && process.env.NODE_ENV === 'production') {
    reply.code(403).send({ error: 'FORBIDDEN', message: 'Invalid service name' });
    return false;
  }
  return true;
}

export default async function internalRoutes(app: FastifyInstance) {
  // =========================================================================
  // POST /internal/clusters/:cluster_id/snapshot
  // =========================================================================
  app.post<{ Params: { cluster_id: string } }>(
    '/internal/clusters/:cluster_id/snapshot',
    async (req, reply) => {
      if (!validateServiceHeader(req, reply)) return;

      const { cluster_id } = req.params;

      try {
        // In production, query f2.clusters to verify existence
        // For now, we'll accept any cluster_id

        // Get all bins in cluster
        // In production, filter by cluster_id from f2 database
        const allBins = store.getAllBins();
        const clusterBins = allBins.filter((b) => b.cluster_id === cluster_id || !b.cluster_id);

        if (clusterBins.length === 0) {
          return reply.code(404).send({
            error: 'CLUSTER_NOT_FOUND',
            message: `Cluster ${cluster_id} does not exist`,
          });
        }

        // Calculate metrics
        let collectible_count = 0;
        let collectible_weight = 0;
        let highest_urgency = 0;
        let highest_urgency_bin_id = '';

        const bins = clusterBins.map((bin) => {
          const should_collect = bin.urgency_score >= 80 && !bin.has_active_job;

          if (should_collect) {
            collectible_count++;
            collectible_weight += bin.estimated_weight_kg;
          }

          if (bin.urgency_score > highest_urgency) {
            highest_urgency = bin.urgency_score;
            highest_urgency_bin_id = bin.bin_id;
          }

          return {
            bin_id: bin.bin_id,
            waste_category: bin.waste_category,
            fill_level_pct: bin.fill_level_pct,
            status: bin.status,
            urgency_score: bin.urgency_score,
            estimated_weight_kg: bin.estimated_weight_kg,
            volume_litres: bin.volume_litres,
            avg_kg_per_litre: AVG_KG_PER_LITRE[bin.waste_category],
            predicted_full_at: bin.predicted_full_at || null,
            fill_rate_pct_per_hour: bin.fill_rate_pct_per_hour || 0,
            should_collect,
          };
        });

        const snapshot: ClusterSnapshot = {
          cluster_id,
          cluster_name: 'Main Depot', // From metadata
          zone_id: 1, // From metadata
          lat: 6.9271, // From metadata
          lng: 79.8612, // From metadata
          address: 'Main Waste Management Center', // From metadata
          total_bins: clusterBins.length,
          has_active_job: store.getActiveJobsCountForZone(1) > 0,
          active_job_id: null, // From orchestrator in production
          bins,
          collectible_bins_count: collectible_count,
          collectible_bins_weight_kg: parseFloat(collectible_weight.toFixed(2)),
          highest_urgency_score: highest_urgency,
          highest_urgency_bin_id,
        };

        logger.info({ cluster_id, total_bins: clusterBins.length }, 'Cluster snapshot retrieved');
        return snapshot;
      } catch (error) {
        logger.error(
          { cluster_id, error: error instanceof Error ? error.message : String(error) },
          'Failed to generate cluster snapshot',
        );
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to generate cluster snapshot',
        });
      }
    },
  );

  // =========================================================================
  // POST /internal/clusters/:cluster_id/scan-nearby
  // =========================================================================
  app.post<{
    Params: { cluster_id: string };
    Body: {
      zone_id: number;
      urgency_threshold: number;
      within_minutes: number;
      exclude_cluster_ids: string[];
    };
  }>('/internal/clusters/:cluster_id/scan-nearby', async (req, reply) => {
    if (!validateServiceHeader(req, reply)) return;

    const { cluster_id } = req.params;
    const { zone_id, urgency_threshold, exclude_cluster_ids } = req.body;

    try {
      // Find other clusters in the same zone with urgent bins
      // In production, this would use geospatial queries
      const allBins = store.getAllBins();
      const zoneBins = allBins.filter((b) => Number(b.zone_id) === zone_id);

      // Group bins by cluster
      const clusterMap = new Map<string, BinState[]>();
      zoneBins.forEach((bin) => {
        const cid = bin.cluster_id || 'UNKNOWN';
        if (!clusterMap.has(cid)) {
          clusterMap.set(cid, []);
        }
        clusterMap.get(cid)!.push(bin);
      });

      // Find clusters that meet criteria
      const clusters = [];
      for (const [cid, bins] of clusterMap) {
        if (cid === cluster_id || exclude_cluster_ids.includes(cid)) {
          continue;
        }

        const urgentBins = bins.filter((b) => b.urgency_score >= urgency_threshold);
        if (urgentBins.length === 0) {
          continue;
        }

        const totalWeight = urgentBins.reduce((sum, b) => sum + b.estimated_weight_kg, 0);

        clusters.push({
          cluster_id: cid,
          cluster_name: `Cluster ${cid}`, // From metadata
          lat: urgentBins[0]?.lat || 0,
          lng: urgentBins[0]?.lng || 0,
          distance_km: Math.random() * 5, // Dummy distance — in production use geo queries
          highest_urgency_score: Math.max(...urgentBins.map((b) => b.urgency_score)),
          predicted_urgent_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          collectible_weight_kg: parseFloat(totalWeight.toFixed(2)),
          bins_to_collect: urgentBins.map((b) => b.bin_id),
        });
      }

      logger.info(
        { cluster_id, zone_id, found_clusters: clusters.length },
        'Nearby clusters scan completed',
      );
      return { clusters };
    } catch (error) {
      logger.error(
        {
          cluster_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to scan nearby clusters',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to scan nearby clusters',
      });
    }
  });

  // =========================================================================
  // POST /internal/bins/:bin_id/mark-collected
  // =========================================================================
  app.post<{
    Params: { bin_id: string };
    Body: {
      job_id: string;
      driver_id: string;
      collected_at: string;
      fill_level_at_collection?: number;
      actual_weight_kg?: number;
    };
  }>('/internal/bins/:bin_id/mark-collected', async (req, reply) => {
    if (!validateServiceHeader(req, reply)) return;

    const { bin_id } = req.params;
    const { job_id, driver_id, collected_at, fill_level_at_collection, actual_weight_kg } =
      req.body;

    try {
      const bin = store.getBin(bin_id);
      if (!bin) {
        return reply.code(404).send({
          error: 'RESOURCE_NOT_FOUND',
          message: `Bin ${bin_id} not found`,
        });
      }

      // Update bin state
      const updated = store.upsertBin({
        bin_id,
        fill_level_pct: fill_level_at_collection ?? 0,
        urgency_score: 0,
        status: 'normal',
        last_collected_at: collected_at,
        has_active_job: false,
      });

      // Publish dashboard update
      await publishToDashboard({
        version: '1.0',
        source_service: 'bin-status-service',
        timestamp: new Date().toISOString(),
        event_type: 'bin:update',
        payload: {
          bin_id,
          cluster_id: bin.cluster_id || 'CLUSTER-001',
          cluster_name: bin.cluster_name || 'Main Depot',
          zone_id: Number(bin.zone_id),
          fill_level_pct: 0,
          status: 'normal',
          urgency_score: 0,
          estimated_weight_kg: 0,
          waste_category: bin.waste_category,
          waste_category_colour: '#00AA00',
          fill_rate_pct_per_hour: 0,
          predicted_full_at: null,
          battery_level_pct: bin.battery_level_pct || 100,
          has_active_job: false,
          collection_triggered: false,
          last_collected_at: collected_at,
        },
      });

      logger.info(
        { bin_id, job_id, driver_id, collected_at },
        'Bin marked as collected',
      );

      return {
        success: true,
        bin_id,
        collected_at,
      };
    } catch (error) {
      logger.error(
        {
          bin_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to mark bin as collected',
      );
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to mark bin as collected',
      });
    }
  });

  // Health check
  app.get('/internal/health', async (req) => {
    return { status: 'ok', service: 'bin-status-service' };
  });
}
