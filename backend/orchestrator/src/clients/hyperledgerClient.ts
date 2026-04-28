const KONG_URL = process.env.KONG_URL ?? 'http://localhost:8000';

export async function recordCollection(params: {
  job_id: string;
  job_type: string;
  zone_id: number;
  driver_id: string;
  vehicle_id: string;
  bins_collected: Array<{
    bin_id: string;
    collected_at: string;
    fill_level_at_collection: number;
    actual_weight_kg?: number;
    gps_lat: number;
    gps_lng: number;
  }>;
  total_weight_kg: number;
  route_distance_km: number;
  started_at: string;
  completed_at: string;
  gps_trail_hash: string;
}): Promise<{ tx_id: string }> {
  const res = await fetch(`${KONG_URL}/api/v1/blockchain/collections`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
    signal:  AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Hyperledger record failed: HTTP ${res.status}`);
  return res.json() as Promise<{ tx_id: string }>;
}
