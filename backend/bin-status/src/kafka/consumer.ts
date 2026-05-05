import { Kafka, logLevel, Consumer } from 'kafkajs';
import pino from 'pino';
import {
  BinProcessedEvent,
  ZoneStatisticsEvent,
  DashboardUpdateEvent,
  BinUpdatePayload,
  ZoneStatsPayload,
  AlertPayload,
} from '../types';
import { store } from '../store';
import { publishToDashboard } from '../publishers/dashboardPublisher';
import { shouldTriggerCollection } from '../rules/collectionTrigger';
import { shouldPushToDashboard, updateFilterState } from '../rules/dashboardFilter';
import { classifyUrgency } from '../rules/urgencyClassifier';
import { calculateBinWeightByCategory } from '../rules/weightCalculator';
import { startManualConsumer } from './manualConsumer';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092')
    .split(',')
    .map((b) => b.trim());
  const user = process.env.KAFKA_USER;
  const pass = process.env.KAFKA_PASS;

  return new Kafka({
    clientId: 'bin-status-service',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass
      ? {
          sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
        }
      : {}),
  });
}

/**
 * Process a single bin.processed message
 * Implements the 6-step processing pipeline from the spec
 */
async function processBinProcessedMessage(event: BinProcessedEvent): Promise<void> {
  const { payload } = event;
  const { bin_id } = payload;
  const now = new Date().toISOString();

  try {
    // Step 1 & 5: Load bin metadata for enrichment
    const meta = await getBinMetadata(bin_id);
    
    const volume_litres = meta?.volume_litres ?? 240;
    const waste_category = meta?.waste_category ?? 'general';

    // Step 2: Recalculate weight
    const estimated_weight_kg = calculateBinWeightByCategory(
      payload.fill_level_pct,
      volume_litres,
      waste_category as any,
    );

    // Step 3: Check collection trigger
    const hasActiveJob = store.hasActiveJobForBin(bin_id);
    const { shouldTrigger: collection_triggered } = shouldTriggerCollection(
      payload.urgency_score,
      hasActiveJob,
    );

    // Classify urgency status
    const { status } = classifyUrgency(payload.urgency_score, payload.status);

    // Step 4: Smart dashboard filter
    const previousState = store.getBinFilterState(bin_id);
    const filterResult = shouldPushToDashboard(
      {
        status,
        urgencyScore: payload.urgency_score,
        fillLevelPct: payload.fill_level_pct,
        batteryLevelPct: payload.battery_level_pct,
        hasActiveJob,
      },
      previousState,
    );

    if (!filterResult.shouldPush) {
      logger.debug(
        { bin_id, reason: filterResult.reason },
        'Suppressing bin update (filter)',
      );
      return;
    }

    // Step 5: Enrich payload
    const enriched: BinUpdatePayload = {
      bin_id,
      cluster_id: meta?.cluster_id ?? 'CLUSTER-001',
      cluster_name: meta?.cluster_name ?? 'Main Depot',
      zone_id: meta?.zone_id ?? 1,
      fill_level_pct: payload.fill_level_pct,
      status,
      urgency_score: payload.urgency_score,
      estimated_weight_kg,
      waste_category,
      waste_category_colour: meta?.waste_category_colour ?? '#808080',
      fill_rate_pct_per_hour: payload.fill_rate_pct_per_hour,
      predicted_full_at: payload.predicted_full_at,
      battery_level_pct: payload.battery_level_pct,
      has_active_job: hasActiveJob,
      collection_triggered,
      last_collected_at: null,
    };

    // Step 6: Publish to waste.bin.dashboard.updates
    const dashboardEvent: DashboardUpdateEvent<BinUpdatePayload> = {
      version: '1.0',
      source_service: 'bin-status-service',
      timestamp: now,
      event_type: 'bin:update',
      payload: enriched,
    };

    await publishToDashboard(dashboardEvent);

    // Update filter state for next message
    store.setBinFilterState(
      bin_id,
      updateFilterState(previousState, {
        status,
        urgencyScore: payload.urgency_score,
        fillLevelPct: payload.fill_level_pct,
      }),
    );

    // If urgent and not already handled, publish alert
    if (collection_triggered && payload.urgency_score >= 80) {
      const alertEvent: DashboardUpdateEvent<AlertPayload> = {
        version: '1.0',
        source_service: 'bin-status-service',
        timestamp: now,
        event_type: 'alert:urgent',
        payload: {
          bin_id,
          cluster_id: enriched.cluster_id,
          zone_id: enriched.zone_id,
          urgency_score: payload.urgency_score,
          waste_category,
          estimated_weight_kg,
          predicted_full_at: payload.predicted_full_at,
          message: `BIN-${bin_id.split('-')[1]} is ${payload.fill_level_pct}% full — no collection scheduled`,
        },
      };
      await publishToDashboard(alertEvent);
    }

    logger.debug(
      { bin_id, status, urgency_score: payload.urgency_score },
      'Processed bin.processed message',
    );
  } catch (error) {
    logger.error(
      {
        bin_id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to process bin.processed message',
    );
    // Continue processing — do not crash consumer
  }
}

/**
 * Process a single zone.statistics message
 */
async function processZoneStatisticsMessage(event: ZoneStatisticsEvent): Promise<void> {
  const { payload } = event;
  const { zone_id } = payload;
  const now = new Date().toISOString();

  try {
    // Step 1: Check if meaningful change occurred
    const cachedStats = store.getZoneCacheEntry(zone_id);

    const significantChange =
      !cachedStats ||
      Math.abs(payload.avg_fill_level_pct - (cachedStats.lastAvgFill ?? 0)) >= 2 ||
      payload.urgent_bin_count !== cachedStats.lastUrgentCount ||
      payload.critical_bin_count !== cachedStats.lastCriticalCount;

    if (!significantChange) {
      logger.debug({ zone_id }, 'Zone stats change below threshold — suppressing');
      return;
    }

    // Step 2: Enrich with job context and metadata
    const meta = await getZoneMetadata(zone_id);
    const active_jobs_count = store.getActiveJobsCountForZone(zone_id);
    const unassigned_urgent_bins = store.getUnassignedUrgentBinsInZone(zone_id);

    const enriched: ZoneStatsPayload = {
      zone_id,
      zone_name: meta?.zone_name ?? `Zone ${zone_id}`,
      avg_fill_level_pct: payload.avg_fill_level_pct,
      urgent_bin_count: payload.urgent_bin_count,
      critical_bin_count: payload.critical_bin_count,
      total_bins: meta?.total_bins ?? payload.total_bins,
      total_estimated_weight_kg: payload.total_estimated_weight_kg,
      dominant_waste_category: payload.dominant_waste_category,
      category_breakdown: payload.category_breakdown,
      active_jobs_count,
      unassigned_urgent_bins,
    };

    // Step 3: Publish to waste.bin.dashboard.updates
    const dashboardEvent: DashboardUpdateEvent<ZoneStatsPayload> = {
      version: '1.0',
      source_service: 'bin-status-service',
      timestamp: now,
      event_type: 'zone:stats',
      payload: enriched,
    };

    await publishToDashboard(dashboardEvent);

    // Update cache
    store.setZoneCacheEntry(zone_id, {
      lastAvgFill: payload.avg_fill_level_pct,
      lastUrgentCount: payload.urgent_bin_count,
      lastCriticalCount: payload.critical_bin_count,
      lastPublishedAt: Date.now(),
    });

    logger.debug(
      { zone_id, avg_fill: payload.avg_fill_level_pct },
      'Processed zone.statistics message',
    );
  } catch (error) {
    logger.error(
      {
        zone_id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to process zone.statistics message',
    );
    // Continue processing — do not crash consumer
  }
}

export async function startKafkaConsumer(): Promise<void> {
  const log = (level: string, msg: string) => {
    if (level === 'ERROR') logger.error(msg);
    else if (level === 'WARN') logger.warn(msg);
    else logger.info(msg);
  };

  // 1. Bin Processed Consumer
  await startManualConsumer(
    'bin-status-service-bin-processed',
    'waste.bin.processed',
    async (value) => {
      try {
        const event = JSON.parse(value.toString()) as BinProcessedEvent;
        await processBinProcessedMessage(event);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to parse waste.bin.processed message');
      }
    },
    log
  );

  // 2. Zone Statistics Consumer
  await startManualConsumer(
    'bin-status-service-zone-statistics',
    'waste.zone.statistics',
    async (value) => {
      try {
        const event = JSON.parse(value.toString()) as ZoneStatisticsEvent;
        await processZoneStatisticsMessage(event);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to parse waste.zone.statistics message');
      }
    },
    log
  );

  logger.info('Kafka manual consumers started: waste.bin.processed, waste.zone.statistics');
}
