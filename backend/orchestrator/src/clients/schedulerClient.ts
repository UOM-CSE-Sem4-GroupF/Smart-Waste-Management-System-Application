import { DispatchResult } from '../types';

const BASE = process.env.SCHEDULER_URL ?? 'http://scheduler:3003';

export interface DispatchParams {
  job_id:                      string;
  cluster_ids:                 string[];
  bin_ids:                     string[];
  total_estimated_weight_kg:   number;
  waste_category:              string;
  zone_id:                     string;
  urgency_score?:              number;
}

export async function dispatch(params: DispatchParams): Promise<DispatchResult> {
  const perBinWeight = params.bin_ids.length > 0
    ? params.total_estimated_weight_kg / params.bin_ids.length
    : 0;

  const body = {
    job_id:    params.job_id,
    clusters:  params.cluster_ids.map(id => ({ cluster_id: id, lat: 0, lng: 0, cluster_name: id })),
    bins_to_collect: params.bin_ids.map(bid => ({
      bin_id:               bid,
      cluster_id:           params.cluster_ids[0] ?? params.zone_id,
      lat:                  0,
      lng:                  0,
      waste_category:       params.waste_category,
      fill_level_pct:       0,
      urgency_score:        params.urgency_score ?? 80,
      estimated_weight_kg:  parseFloat(perBinWeight.toFixed(2)),
      predicted_full_at:    null,
    })),
    total_estimated_weight_kg: params.total_estimated_weight_kg,
    waste_category:            params.waste_category,
    zone_id:                   params.zone_id,
    priority:                  params.urgency_score ?? 80,
  };

  const res = await fetch(`${BASE}/internal/scheduler/dispatch`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json() as DispatchResult & { reason?: string };
  if (!res.ok || data.success === false) {
    throw new Error(data.reason ?? `Scheduler responded ${res.status}`);
  }
  return data;
}

export async function releaseDriver(job_id: string): Promise<void> {
  try {
    await fetch(`${BASE}/internal/scheduler/release`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id }),
    });
  } catch {
    // best-effort
  }
}
