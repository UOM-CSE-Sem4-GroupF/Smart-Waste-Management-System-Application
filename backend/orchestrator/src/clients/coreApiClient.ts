const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service:8001';

const slog = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator:coreApiClient', message: msg, ...extra,
  }) + '\n');
};

async function timedFetch(label: string, url: string, init?: RequestInit): Promise<Response> {
  const t0 = Date.now();
  const method = init?.method ?? 'GET';
  slog('DEBUG', `→ ${method} ${url}`, { label });
  try {
    const res = await fetch(url, init);
    slog('DEBUG', `← ${method} ${url} ${res.status} (${Date.now() - t0}ms)`, { label, status: res.status });
    return res;
  } catch (e) {
    slog('ERROR', `✗ ${method} ${url} FAILED (${Date.now() - t0}ms): ${(e as Error).message}`, { label });
    throw e;
  }
}

export interface F2Cluster {
  id: string;
  zone_id: number;
  name: string;
  lat: number;
  lng: number;
}

export async function getClustersForZone(zone_id: string | number): Promise<F2Cluster[]> {
  const url = `${CORE_API}/api/v1/clusters?zone_id=${zone_id}&limit=200`;
  slog('DEBUG', `getClustersForZone: fetching clusters for zone ${zone_id}`, { zone_id, url });

  try {
    const res = await timedFetch('getClustersForZone', url);
    if (!res.ok) {
      slog('WARN', `getClustersForZone: Core API returned ${res.status} for zone ${zone_id}`, { zone_id, status: res.status });
      return [];
    }
    const body = await res.json() as { data?: F2Cluster[] };
    const clusters = body.data ?? [];
    slog('DEBUG', `getClustersForZone: got ${clusters.length} clusters for zone ${zone_id}`, {
      zone_id,
      count:       clusters.length,
      cluster_ids: clusters.map(c => c.id),
    });
    return clusters;
  } catch (e) {
    slog('ERROR', `getClustersForZone: exception for zone ${zone_id}: ${(e as Error).message}`, { zone_id });
    return [];
  }
}
