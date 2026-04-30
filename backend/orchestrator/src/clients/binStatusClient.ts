import { ClusterSnapshot, UrgencyConfirmation } from '../types';

const BASE = process.env.BIN_STATUS_URL ?? 'http://bin-status:3002';

interface BinState {
  bin_id:              string;
  fill_level_pct:      number;
  urgency_score:       number;
  urgency_status:      string;
  estimated_weight_kg: number;
  waste_category:      string;
  volume_litres:       number;
  zone_id:             string;
  lat:                 number;
  lng:                 number;
  last_reading_at:     string;
}

async function fetchBins(): Promise<BinState[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/bins`);
    if (!res.ok) return [];
    const body = await res.json() as { data?: BinState[] } | BinState[];
    return Array.isArray(body) ? body : (body.data ?? []);
  } catch {
    return [];
  }
}

function buildSnapshot(zone_id: string, bins: BinState[]): ClusterSnapshot {
  const zoneBins = bins.filter(b => b.zone_id === zone_id);
  const clusterBins = zoneBins.map(b => ({
    bin_id:               b.bin_id,
    urgency_score:        b.urgency_score,
    estimated_weight_kg:  b.estimated_weight_kg,
    predicted_full_at:    null as string | null,
    should_collect:       b.urgency_score >= 80,
  }));
  const collectibleWeight = clusterBins
    .filter(b => b.should_collect)
    .reduce((s, b) => s + b.estimated_weight_kg, 0);
  return {
    cluster_id:                 zone_id,
    bins:                       clusterBins,
    collectible_bins_weight_kg: parseFloat(collectibleWeight.toFixed(2)),
  };
}

export async function getClusterSnapshot(zone_id: string): Promise<ClusterSnapshot | null> {
  try {
    const bins     = await fetchBins();
    const snapshot = buildSnapshot(zone_id, bins);
    return snapshot;
  } catch {
    return null;
  }
}

export async function scanNearby(params: {
  zone_id:              string;
  urgency_threshold:    number;
  within_minutes:       number;
  exclude_cluster_ids:  string[];
}): Promise<{ clusters: ClusterSnapshot[] }> {
  try {
    const bins = await fetchBins();
    const allZones = [...new Set(bins.map(b => b.zone_id))];
    const clusters: ClusterSnapshot[] = [];

    for (const zone_id of allZones) {
      if (zone_id === params.zone_id) continue;
      if (params.exclude_cluster_ids.includes(zone_id)) continue;
      const zoneBins = bins.filter(b => b.zone_id === zone_id && b.urgency_score >= params.urgency_threshold);
      if (zoneBins.length === 0) continue;
      clusters.push(buildSnapshot(zone_id, bins));
    }
    return { clusters };
  } catch {
    return { clusters: [] };
  }
}

export async function confirmUrgency(bin_id: string): Promise<UrgencyConfirmation | null> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${bin_id}/confirm-urgency`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    return res.json() as Promise<UrgencyConfirmation>;
  } catch {
    return null;
  }
}

export async function markCollected(bin_id: string, job_id: string, collected_at?: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${bin_id}/mark-collected`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id, collected_at: collected_at ?? new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
