import { CollectionJob, ClusterSnapshot, AssembleResult } from '../types';
import { getClusterSnapshot, scanNearby } from '../clients/binStatusClient';

const IMMEDIATE_CATEGORIES = ['e_waste', 'hazardous'];
const SAFETY_MARGIN_MS     = 45 * 60 * 1000;

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

function buildResult(clusters: ClusterSnapshot[]): AssembleResult {
  const allBinIds = clusters.flatMap(c =>
    c.bins.filter(b => b.should_collect).map(b => b.bin_id),
  );
  const uniqueBinIds = [...new Set(allBinIds)];
  const totalWeight  = clusters.reduce((s, c) => s + c.collectible_bins_weight_kg, 0);
  return {
    cluster_ids:     clusters.map(c => c.cluster_id),
    bin_ids:         uniqueBinIds,
    total_weight_kg: parseFloat(totalWeight.toFixed(2)),
  };
}

export async function assemble(params: {
  job:              CollectionJob;
  urgency_score:    number;
  waste_category:   string;
  zone_id:          string;
  initialSnapshot:  ClusterSnapshot;
}): Promise<AssembleResult> {
  const { urgency_score, waste_category, zone_id, initialSnapshot } = params;
  const WAIT_WINDOW_MAX_MS = Number(process.env.WAIT_WINDOW_MAX_MS ?? 30 * 60 * 1000);

  const clusters: ClusterSnapshot[] = [initialSnapshot];

  const isImmediate = urgency_score >= 90 || IMMEDIATE_CATEGORIES.includes(waste_category);
  if (isImmediate) {
    return buildResult(clusters);
  }

  // Calculate wait window from predicted_full_at timestamps
  const predictedFullTimestamps = initialSnapshot.bins
    .filter(b => b.should_collect && b.predicted_full_at)
    .map(b => new Date(b.predicted_full_at!).getTime())
    .filter(t => !isNaN(t));

  const earliestFull = predictedFullTimestamps.length > 0
    ? Math.min(...predictedFullTimestamps)
    : Date.now() + WAIT_WINDOW_MAX_MS;

  const waitUntil = Math.min(
    earliestFull - SAFETY_MARGIN_MS,
    Date.now() + WAIT_WINDOW_MAX_MS,
  );

  const withinMinutes = Math.max(1, Math.round((waitUntil - Date.now()) / 60_000));

  // First scan — look for nearby clusters approaching urgency
  const nearbyScan = await scanNearby({
    zone_id,
    urgency_threshold:   70,
    within_minutes:      withinMinutes,
    exclude_cluster_ids: clusters.map(c => c.cluster_id),
  });

  if (nearbyScan.clusters.length > 0) {
    for (const nearby of nearbyScan.clusters) {
      const snap = await getClusterSnapshot(nearby.cluster_id);
      if (snap) clusters.push(snap);
    }
    return buildResult(clusters);
  }

  // Wait, then re-scan
  const remainingWaitMs = waitUntil - Date.now();
  if (remainingWaitMs > 0) {
    await sleep(remainingWaitMs);
  }

  const laterScan = await scanNearby({
    zone_id,
    urgency_threshold:   80,
    within_minutes:      15,
    exclude_cluster_ids: clusters.map(c => c.cluster_id),
  });

  for (const later of laterScan.clusters) {
    const snap = await getClusterSnapshot(later.cluster_id);
    if (snap) clusters.push(snap);
  }

  return buildResult(clusters);
}
