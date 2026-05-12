import { DispatchResult } from '../types';

const BASE = process.env.SCHEDULER_URL ?? 'http://scheduler:3003';
const SERVICE_HEADER = { 'Content-Type': 'application/json' };

const slog = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator:schedulerClient', message: msg, ...extra,
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

  slog('INFO', `dispatch: sending job ${params.job_id} to scheduler`, {
    job_id:        params.job_id,
    zone_id:       params.zone_id,
    cluster_count: params.cluster_ids.length,
    bin_count:     params.bin_ids.length,
    weight_kg:     params.total_estimated_weight_kg,
    urgency:       params.urgency_score,
    url:           `${BASE}/internal/scheduler/dispatch`,
  });

  const res = await timedFetch('dispatch', `${BASE}/internal/scheduler/dispatch`, {
    method:  'POST',
    headers: SERVICE_HEADER,
    body:    JSON.stringify(body),
  });

  const data = await res.json() as DispatchResult & { reason?: string };

  if (!res.ok || data.success === false) {
    slog('WARN', `dispatch: scheduler rejected job ${params.job_id}`, {
      job_id: params.job_id,
      status: res.status,
      reason: data.reason,
    });
    throw new Error(data.reason ?? `Scheduler responded ${res.status}`);
  }

  slog('INFO', `dispatch: job ${params.job_id} accepted`, {
    job_id:           params.job_id,
    vehicle_id:       data.vehicle_id,
    driver_id:        data.driver_id,
    route_plan_id:    data.route_plan_id,
    est_minutes:      (data as any).estimated_minutes,
    waypoint_count:   Array.isArray(data.route) ? data.route.length : 0,
  });

  return data;
}

export async function releaseDriver(job_id: string): Promise<void> {
  slog('DEBUG', `releaseDriver: releasing resources for job ${job_id}`, {
    job_id,
    url: `${BASE}/internal/scheduler/release`,
  });

  try {
    const res = await timedFetch('releaseDriver', `${BASE}/internal/scheduler/release`, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify({ job_id }),
    });

    if (res.ok) {
      slog('DEBUG', `releaseDriver: job ${job_id} resources released`, { job_id });
    } else {
      slog('WARN', `releaseDriver: scheduler returned ${res.status} for job ${job_id}`, { job_id, status: res.status });
    }
  } catch (e) {
    slog('WARN', `releaseDriver: exception for job ${job_id}: ${(e as Error).message}`, { job_id });
    // best-effort
  }
}
