import { BinProcessedEvent, ClusterSnapshot } from '../types';
import { getClusterSnapshot, scanNearby } from '../clients/binStatusClient';

const IMMEDIATE_CATEGORIES = ['e_waste', 'hazardous'];
const SAFETY_MARGIN_MS     = 45 * 60 * 1000;
const MAX_WAIT_MS          = 30 * 60 * 1000;

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

interface AssembleResult {
  cluster_ids: string[];
  bin_ids: string[];
  total_weight_kg: number;
}

function buildResult(clusters: ClusterSnapshot[]): AssembleResult {
  const bin_ids = clusters.flatMap(c =>
    c.bins.filter(b => b.should_collect).map(b => b.bin_id)
  );
  const total = clusters.reduce((s, c) => s + c.collectible_bins_weight_kg, 0);
  return {
    cluster_ids:     clusters.map(c => c.cluster_id),
    bin_ids,
    total_weight_kg: parseFloat(total.toFixed(2)),
  };
}

export async function assemble(params: {
  jobId: string;
  triggerBinEvent: BinProcessedEvent;
  initialSnapshot: ClusterSnapshot;
}): Promise<AssembleResult> {
  const { triggerBinEvent, initialSnapshot } = params;
  const clusters: ClusterSnapshot[] = [initialSnapshot];

  const isImmediate =
    triggerBinEvent.urgency_score >= 90 ||
    IMMEDIATE_CATEGORIES.includes(triggerBinEvent.waste_category);

  if (isImmediate) return buildResult(clusters);

  const predictedTimes = initialSnapshot.bins
    .filter(b => b.should_collect && b.predicted_full_at)
    .map(b => new Date(b.predicted_full_at!).getTime())
    .filter(t => !isNaN(t));

  const earliest    = predictedTimes.length ? Math.min(...predictedTimes) : Infinity;
  const waitUntil   = Math.min(earliest - SAFETY_MARGIN_MS, Date.now() + MAX_WAIT_MS);
  const remainingMs = waitUntil - Date.now();
  const withinMin   = Math.max(1, Math.round(Math.max(remainingMs, 0) / 60_000));

  const nearby = await scanNearby({
    zone_id:             triggerBinEvent.zone_id,
    urgency_threshold:   70,
    within_minutes:      withinMin,
    exclude_cluster_ids: clusters.map(c => c.cluster_id),
  });

  if (nearby.clusters.length > 0) {
    for (const c of nearby.clusters) {
      clusters.push(await getClusterSnapshot(c.cluster_id));
    }
    return buildResult(clusters);
  }

  if (remainingMs > 0) {
    await sleep(remainingMs);

    const later = await scanNearby({
      zone_id:             triggerBinEvent.zone_id,
      urgency_threshold:   80,
      within_minutes:      15,
      exclude_cluster_ids: clusters.map(c => c.cluster_id),
    });

    for (const c of later.clusters) {
      clusters.push(await getClusterSnapshot(c.cluster_id));
    }
  }

  return buildResult(clusters);
}
