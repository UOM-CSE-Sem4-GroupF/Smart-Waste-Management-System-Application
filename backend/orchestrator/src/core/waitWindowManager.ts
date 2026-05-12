import { CollectionJob, ClusterSnapshot, AssembleResult } from '../types';
import { getZoneSnapshot } from '../clients/binStatusClient';

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
  cluster_id:       string;
  initialSnapshot:  ClusterSnapshot;
}): Promise<AssembleResult> {
  const { urgency_score, waste_category, zone_id, cluster_id, initialSnapshot } = params;
  const WAIT_WINDOW_MAX_MS = Number(process.env.WAIT_WINDOW_MAX_MS ?? 30 * 60 * 1000);

  // Critical or special-handling waste → dispatch immediately with trigger cluster only
  const isImmediate = urgency_score >= 90 || IMMEDIATE_CATEGORIES.includes(waste_category);
  if (isImmediate) {
    return buildResult([initialSnapshot]);
  }

  // Calculate wait window from predicted_full_at of collectible bins
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

  // First zone scan — find all clusters in zone approaching urgency (score >= 70)
  const zoneClusters = await getZoneSnapshot(zone_id, 70);

  // Exclude the trigger cluster (already in initialSnapshot) and merge others
  const additional = zoneClusters.filter(s => s.cluster_id !== cluster_id);

  if (additional.length > 0) {
    // Other clusters already approaching urgency — batch them now, don't wait
    return buildResult([initialSnapshot, ...additional]);
  }

  // No other clusters approaching urgency yet — wait, then re-scan at higher threshold
  const remainingWaitMs = waitUntil - Date.now();
  if (remainingWaitMs > 0) {
    await sleep(remainingWaitMs);
  }

  const laterZoneClusters = await getZoneSnapshot(zone_id, 80);
  const laterAdditional = laterZoneClusters.filter(s => s.cluster_id !== cluster_id);

  return buildResult([initialSnapshot, ...laterAdditional]);
}
