import { ClusterSnapshot } from '../types';
import { getClustersForZone } from './coreApiClient';

const BASE = process.env.BIN_STATUS_URL ?? 'http://bin-status:3002';
const SERVICE_HEADER = { 'X-Service-Name': 'workflow-orchestrator', 'Content-Type': 'application/json' };

const slog = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator:binStatusClient', message: msg, ...extra,
  }) + '\n');
};

async function timedFetch(label: string, url: string, init: RequestInit): Promise<Response> {
  const t0 = Date.now();
  slog('DEBUG', `→ ${init.method ?? 'GET'} ${url}`, { label });
  try {
    const res = await fetch(url, init);
    slog('DEBUG', `← ${init.method ?? 'GET'} ${url} ${res.status} (${Date.now() - t0}ms)`, { label, status: res.status });
    return res;
  } catch (e) {
    slog('ERROR', `✗ ${init.method ?? 'GET'} ${url} FAILED (${Date.now() - t0}ms): ${(e as Error).message}`, { label });
    throw e;
  }
}

export async function getClusterSnapshot(cluster_id: string): Promise<ClusterSnapshot | null> {
  slog('DEBUG', `getClusterSnapshot: requesting snapshot for cluster ${cluster_id}`, { cluster_id, url: `${BASE}/internal/clusters/${cluster_id}/snapshot` });
  try {
    const res = await timedFetch('getClusterSnapshot', `${BASE}/internal/clusters/${cluster_id}/snapshot`, {
      method: 'POST',
      headers: SERVICE_HEADER,
    });

    if (!res.ok) {
      slog('WARN', `getClusterSnapshot: bin-status returned ${res.status} for cluster ${cluster_id}`, { cluster_id, status: res.status });
      return null;
    }

    const data = await res.json() as any;
    slog('DEBUG', `getClusterSnapshot: received snapshot`, {
      cluster_id,
      total_bins: data.bins?.length ?? 0,
      collectible_bins: data.bins?.filter((b: any) => b.should_collect).length ?? 0,
      collectible_weight_kg: data.collectible_bins_weight_kg,
      highest_urgency: data.highest_urgency_score,
      has_active_job: data.has_active_job,
    });

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
  } catch (e) {
    slog('ERROR', `getClusterSnapshot: exception for cluster ${cluster_id}: ${(e as Error).message}`, { cluster_id });
    return null;
  }
}

export async function scanNearby(params: {
  lat:               number;
  lng:               number;
  radius_km:         number;
  min_urgency_score: number;
}): Promise<{ clusters: Array<{ cluster_id: string }> }> {
  slog('DEBUG', 'scanNearby: scanning for nearby clusters', { ...params, url: `${BASE}/internal/clusters/scan-nearby` });
  try {
    const res = await timedFetch('scanNearby', `${BASE}/internal/clusters/scan-nearby`, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify(params),
    });

    if (!res.ok) {
      slog('WARN', `scanNearby: bin-status returned ${res.status}`, { status: res.status, params });
      return { clusters: [] };
    }

    const data = await res.json() as { clusters: Array<{ cluster_id: string }> };
    slog('DEBUG', `scanNearby: found ${data.clusters.length} nearby clusters`, {
      found: data.clusters.length,
      cluster_ids: data.clusters.map(c => c.cluster_id),
    });
    return data;
  } catch (e) {
    slog('ERROR', `scanNearby: exception: ${(e as Error).message}`, { params });
    return { clusters: [] };
  }
}

export async function getZoneSnapshot(
  zone_id: string | number,
  min_urgency_score = 70,
): Promise<ClusterSnapshot[]> {
  slog('DEBUG', `getZoneSnapshot: fetching clusters for zone ${zone_id}`, { zone_id, min_urgency_score });

  const f2Clusters = await getClustersForZone(zone_id);
  slog('DEBUG', `getZoneSnapshot: got ${f2Clusters.length} clusters from Core API for zone ${zone_id}`, {
    zone_id,
    cluster_ids: f2Clusters.map(c => c.id),
  });

  if (f2Clusters.length === 0) return [];

  const snapshots = await Promise.all(f2Clusters.map(c => getClusterSnapshot(c.id)));
  const filtered = snapshots.filter((s): s is ClusterSnapshot =>
    s !== null && s.bins.some(b => b.urgency_score >= min_urgency_score && b.should_collect),
  );

  slog('DEBUG', `getZoneSnapshot: ${filtered.length}/${f2Clusters.length} clusters pass urgency threshold`, {
    zone_id,
    min_urgency_score,
    passing_clusters: filtered.map(s => s.cluster_id),
  });

  return filtered;
}

export async function markCollected(bin_id: string, job_id: string, collected_at?: string): Promise<boolean> {
  const ts = collected_at ?? new Date().toISOString();
  slog('DEBUG', `markCollected: marking bin ${bin_id} as collected for job ${job_id}`, { bin_id, job_id, collected_at: ts });

  try {
    const res = await timedFetch('markCollected', `${BASE}/internal/bins/${bin_id}/mark-collected`, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify({ job_id, collected_at: ts }),
    });

    if (res.ok) {
      slog('DEBUG', `markCollected: bin ${bin_id} marked successfully`, { bin_id, job_id });
    } else {
      slog('WARN', `markCollected: bin-status returned ${res.status} for bin ${bin_id}`, { bin_id, job_id, status: res.status });
    }
    return res.ok;
  } catch (e) {
    slog('ERROR', `markCollected: exception for bin ${bin_id}: ${(e as Error).message}`, { bin_id, job_id });
    return false;
  }
}
