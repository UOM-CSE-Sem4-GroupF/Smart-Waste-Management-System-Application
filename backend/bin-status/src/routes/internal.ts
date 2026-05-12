import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { store } from '../store';
import { ClusterSnapshot, BinState } from '../types';
import { AVG_KG_PER_LITRE } from '../rules/weightCalculator';
import { publishToDashboard } from '../publishers/dashboardPublisher';
import { getClusterSnapshot } from '../clients/dataAnalysisClient';
import { hasActiveJobForCluster, hasActiveJobForBin } from '../db/queries';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const CORE_API = process.env.DATA_ANALYSIS_URL ?? 'http://core-api-base-service.waste-dev.svc.cluster.local:8001';

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

async function getActiveJobForBin(bin_id: string): Promise<boolean> {
  try {
    return await hasActiveJobForBin(bin_id);
  } catch {
    return false;
  }
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

      logger.info({ cluster_id, service_header: req.headers['x-service-name'] }, 'cluster snapshot request received');

      try {
        // Fetch authoritative cluster + bin state from Core API (F2).
        // F2's bin_current_state is kept current by Flink writing directly,
        // so this is always as fresh as our local Kafka-derived state.
        logger.debug({ cluster_id }, 'Fetching cluster snapshot from Core API (F2)');
        const f2 = await getClusterSnapshot(cluster_id);

        if (!f2) {
          // F2 returned 404 or is unreachable — fall back to local in-memory bins
          logger.warn({ cluster_id }, 'Core API snapshot unavailable — falling back to local store');

          const allBins = store.getAllBins();
          const clusterBins = allBins.filter((b) => b.cluster_id === cluster_id);

          logger.debug({ cluster_id, local_bins: allBins.length }, 'Using local store for snapshot');

          if (clusterBins.length === 0) {
            logger.warn({ cluster_id }, 'Cluster not found in local store either — returning 404');
            return reply.code(404).send({
              error: 'CLUSTER_NOT_FOUND',
              message: `Cluster ${cluster_id} not found`,
            });
          }

          let collectible_count = 0;
          let collectible_weight = 0;
          let highest_urgency = 0;
          let highest_urgency_bin_id = '';
          let cluster_has_active_job = false;

          const bins = await Promise.all(clusterBins.map(async (bin) => {
            const has_active_job = await getActiveJobForBin(bin.bin_id);
            if (has_active_job) cluster_has_active_job = true;
            const should_collect = bin.urgency_score >= 80 && !has_active_job;
            if (should_collect) { collectible_count++; collectible_weight += bin.estimated_weight_kg; }
            if (bin.urgency_score > highest_urgency) { highest_urgency = bin.urgency_score; highest_urgency_bin_id = bin.bin_id; }
            return {
              bin_id: bin.bin_id, waste_category: bin.waste_category,
              fill_level_pct: bin.fill_level_pct, status: bin.status,
              urgency_score: bin.urgency_score, estimated_weight_kg: bin.estimated_weight_kg,
              volume_litres: bin.volume_litres, avg_kg_per_litre: AVG_KG_PER_LITRE[bin.waste_category],
              predicted_full_at: bin.predicted_full_at || null,
              fill_rate_pct_per_hour: bin.fill_rate_pct_per_hour || 0, should_collect,
            };
          }));

          const first = clusterBins[0];
          return {
            cluster_id, cluster_name: first.cluster_name ?? cluster_id,
            zone_id: Number(first.zone_id) || 0, lat: first.lat || 0, lng: first.lng || 0,
            address: null, total_bins: clusterBins.length,
            has_active_job: cluster_has_active_job,
            active_job_id: null, bins,
            collectible_bins_count: collectible_count,
            collectible_bins_weight_kg: parseFloat(collectible_weight.toFixed(2)),
            highest_urgency_score: highest_urgency, highest_urgency_bin_id,
          } as ClusterSnapshot;
        }

        // Stamp each bin with live `should_collect` and `has_active_job` from F3 DB
        let collectible_count = 0;
        let collectible_weight = 0;
        let highest_urgency = 0;
        let highest_urgency_bin_id = '';
        let cluster_has_active_job = false;

        const bins = await Promise.all(f2.bins.map(async (bin) => {
          const localBin = store.getBin(bin.bin_id);
          const has_active_job = await getActiveJobForBin(bin.bin_id);
          if (has_active_job) cluster_has_active_job = true;
          const should_collect = bin.urgency_score >= 80 && !has_active_job;
          if (should_collect) { collectible_count++; collectible_weight += bin.estimated_weight_kg; }
          if (bin.urgency_score > highest_urgency) { highest_urgency = bin.urgency_score; highest_urgency_bin_id = bin.bin_id; }
          return {
            bin_id: bin.bin_id,
            waste_category: bin.waste_category,
            fill_level_pct: localBin?.fill_level_pct ?? 0,
            status: bin.status,
            urgency_score: bin.urgency_score,
            estimated_weight_kg: bin.estimated_weight_kg,
            volume_litres: localBin?.volume_litres ?? 0,
            avg_kg_per_litre: AVG_KG_PER_LITRE[bin.waste_category as keyof typeof AVG_KG_PER_LITRE] ?? AVG_KG_PER_LITRE.general,
            predicted_full_at: localBin?.predicted_full_at ?? null,
            fill_rate_pct_per_hour: localBin?.fill_rate_pct_per_hour ?? 0,
            should_collect,
          };
        }));

        let cluster_active_from_db = cluster_has_active_job;
        if (!cluster_active_from_db) {
          try {
            cluster_active_from_db = await hasActiveJobForCluster(cluster_id);
          } catch {
            // non-fatal
          }
        }

        const snapshot: ClusterSnapshot = {
          cluster_id: f2.cluster_id,
          cluster_name: f2.cluster_name,
          zone_id: f2.zone_id,
          lat: f2.lat,
          lng: f2.lng,
          address: null,
          total_bins: f2.total_bins,
          has_active_job: cluster_active_from_db,
          active_job_id: null,
          bins,
          collectible_bins_count: collectible_count,
          collectible_bins_weight_kg: parseFloat(collectible_weight.toFixed(2)),
          highest_urgency_score: highest_urgency,
          highest_urgency_bin_id,
        };

        logger.info({
          cluster_id,
          total_bins:                f2.total_bins,
          collectible_bins_count:    collectible_count,
          collectible_bins_weight_kg: parseFloat(collectible_weight.toFixed(2)),
          highest_urgency_score:     highest_urgency,
          has_active_job:            cluster_active_from_db,
        }, 'Cluster snapshot built from Core API + F3 DB');
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
  // Body matches service spec: { lat, lng, radius_km, min_urgency_score }
  // Called by orchestrator during wait-window cluster assembly (Option C)
  app.post<{
    Body: {
      lat: number;
      lng: number;
      radius_km: number;
      min_urgency_score: number;
    };
  }>('/internal/clusters/scan-nearby', async (req, reply) => {
    if (!validateServiceHeader(req, reply)) return;

    const { lat, lng, radius_km, min_urgency_score } = req.body;
    logger.info({ lat, lng, radius_km, min_urgency_score }, 'scan-nearby request received');

    try {
      const allBins = store.getAllBins();
      logger.debug({ total_bins_in_store: allBins.length }, 'scan-nearby: checking bins in local store');

      // Group bins by cluster, keeping only those with sufficient urgency
      const clusterMap = new Map<string, BinState[]>();
      for (const bin of allBins) {
        if (bin.urgency_score < min_urgency_score) continue;
        const cid = bin.cluster_id;
        if (!cid) continue;
        if (!clusterMap.has(cid)) clusterMap.set(cid, []);
        clusterMap.get(cid)!.push(bin);
      }

      const clusters = [];
      for (const [cid, clusterBins] of clusterMap) {
        // Use lat/lng from the first bin — populated during Kafka enrichment from F2 metadata
        const clusterLat = clusterBins[0]?.lat ?? 0;
        const clusterLng = clusterBins[0]?.lng ?? 0;
        if (!clusterLat && !clusterLng) continue;

        const distance_km = haversineKm(lat, lng, clusterLat, clusterLng);
        if (distance_km > radius_km) continue;

        const totalWeight = clusterBins.reduce((sum, b) => sum + b.estimated_weight_kg, 0);
        const highestUrgency = Math.max(...clusterBins.map((b) => b.urgency_score));

        clusters.push({
          cluster_id: cid,
          cluster_name: clusterBins[0]?.cluster_name ?? cid,
          lat: clusterLat,
          lng: clusterLng,
          distance_km: parseFloat(distance_km.toFixed(3)),
          highest_urgency_score: highestUrgency,
          collectible_weight_kg: parseFloat(totalWeight.toFixed(2)),
          bins_to_collect: clusterBins.map((b) => b.bin_id),
        });
      }

      // Sort by urgency descending so orchestrator gets highest-priority clusters first
      clusters.sort((a, b) => b.highest_urgency_score - a.highest_urgency_score);

      logger.info({
        lat, lng, radius_km, min_urgency_score,
        found:       clusters.length,
        cluster_ids: clusters.map(c => c.cluster_id),
      }, 'Nearby clusters scan completed');
      return { clusters };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
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

    logger.info({ bin_id, job_id, driver_id, collected_at, fill_level_at_collection, actual_weight_kg }, 'mark-collected request received');

    try {
      const bin = store.getBin(bin_id);
      if (!bin) {
        logger.warn({ bin_id }, 'mark-collected: bin not found in local store');
        return reply.code(404).send({
          error: 'RESOURCE_NOT_FOUND',
          message: `Bin ${bin_id} not found`,
        });
      }
      logger.debug({ bin_id, current_fill: bin.fill_level_pct, current_urgency: bin.urgency_score }, 'mark-collected: bin found in store');

      // Update bin state
      const updated = store.upsertBin({
        bin_id,
        fill_level_pct: fill_level_at_collection ?? 0,
        urgency_score: 0,
        status: 'normal',
        last_collected_at: collected_at,
        has_active_job: false,
      });

      // Propagate last_collected_at to Core API (F2) — fire-and-forget, non-fatal
      fetch(`${CORE_API}/api/v1/bins/${bin_id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_collected_at: collected_at }),
      }).catch((err: Error) =>
        logger.warn({ bin_id, err: err.message }, 'Core API bin state update failed (non-fatal)'),
      );

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
          lat: bin.lat,
          lng: bin.lng,
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
