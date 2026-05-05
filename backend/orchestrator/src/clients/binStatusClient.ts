import { ClusterSnapshot } from '../types';

const BASE = process.env.BIN_STATUS_URL ?? 'http://bin-status:3002';

export async function getClusterSnapshot(clusterId: string): Promise<ClusterSnapshot> {
  const res = await fetch(`${BASE}/internal/clusters/${clusterId}/snapshot`);
  if (!res.ok) throw new Error(`getClusterSnapshot failed: HTTP ${res.status}`);
  return res.json() as Promise<ClusterSnapshot>;
}

export async function scanNearby(params: {
  zone_id: number;
  urgency_threshold: number;
  within_minutes: number;
  exclude_cluster_ids: string[];
}): Promise<{ clusters: Array<{ cluster_id: string }> }> {
  const res = await fetch(`${BASE}/internal/clusters/scan-nearby`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`scanNearby failed: HTTP ${res.status}`);
  return res.json() as Promise<{ clusters: Array<{ cluster_id: string }> }>;
}

export async function markBinCollected(binId: string, params: {
  job_id: string;
  collected_at: string;
  fill_level_at_collection: number;
  actual_weight_kg?: number;
  gps_lat: number;
  gps_lng: number;
}): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${binId}/mark-collected`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });
    return res.ok;
  } catch {
    return false;
  }
}
