const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service:8001';

export interface F2Cluster {
  id: string;
  zone_id: number;
  name: string;
  lat: number;
  lng: number;
}

export async function getClustersForZone(zone_id: string | number): Promise<F2Cluster[]> {
  try {
    const url = `${CORE_API}/api/v1/clusters?zone_id=${zone_id}&limit=200`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = await res.json() as { data?: F2Cluster[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}
