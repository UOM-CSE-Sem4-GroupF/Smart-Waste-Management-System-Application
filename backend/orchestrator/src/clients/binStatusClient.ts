import { ClusterSnapshot } from '../types';
import { getClustersForZone } from './coreApiClient';

const BASE = process.env.BIN_STATUS_URL ?? 'http://bin-status:3002';

const SERVICE_HEADER = { 'X-Service-Name': 'workflow-orchestrator', 'Content-Type': 'application/json' };

export async function getClusterSnapshot(cluster_id: string): Promise<ClusterSnapshot | null> {
  try {
    const res = await fetch(`${BASE}/internal/clusters/${cluster_id}/snapshot`, {
      method: 'POST',
      headers: SERVICE_HEADER,
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return {
      cluster_id: data.cluster_id,
      lat: data.lat,
      lng: data.lng,
      collectible_bins_weight_kg: data.collectible_bins_weight_kg ?? 0,
      bins: (data.bins ?? []).map((b: any) => ({
        bin_id:              b.bin_id,
        urgency_score:       b.urgency_score,
        estimated_weight_kg: b.estimated_weight_kg,
        predicted_full_at:   b.predicted_full_at ?? null,
        should_collect:      b.should_collect,
      })),
    };
  } catch {
    return null;
  }
}

export async function scanNearby(params: {
  lat:               number;
  lng:               number;
  radius_km:         number;
  min_urgency_score: number;
}): Promise<{ clusters: Array<{ cluster_id: string }> }> {
  try {
    const res = await fetch(`${BASE}/internal/clusters/scan-nearby`, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify(params),
    });
    if (!res.ok) return { clusters: [] };
    return res.json() as Promise<{ clusters: Array<{ cluster_id: string }> }>;
  } catch {
    return { clusters: [] };
  }
}

// Fetches live urgency snapshots for ALL clusters in a zone.
// Step 1: GET /api/v1/clusters?zone_id=X from Core API (F2) → cluster IDs
// Step 2: POST /internal/clusters/:id/snapshot on bin-status for each → live urgency state
export async function getZoneSnapshot(
  zone_id: string | number,
  min_urgency_score = 70,
): Promise<ClusterSnapshot[]> {
  const f2Clusters = await getClustersForZone(zone_id);
  if (f2Clusters.length === 0) return [];

  const snapshots = await Promise.all(f2Clusters.map(c => getClusterSnapshot(c.id)));

  return snapshots.filter((s): s is ClusterSnapshot =>
    s !== null && s.bins.some(b => b.urgency_score >= min_urgency_score && b.should_collect),
  );
}

export async function markCollected(bin_id: string, job_id: string, collected_at?: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${bin_id}/mark-collected`, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify({ job_id, collected_at: collected_at ?? new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
