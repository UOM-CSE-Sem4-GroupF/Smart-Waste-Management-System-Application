const BASE = process.env.SCHEDULER_URL ?? 'http://scheduler:3003';

export interface AssignResult {
  driver_id:   string;
  vehicle_id:  string;
  assigned_at: string;
}

export async function assignDriver(params: {
  job_id:              string;
  zone_id:             string;
  waste_category:      string;
  planned_weight_kg:   number;
  exclude_driver_ids?: string[];
}): Promise<AssignResult | null> {
  try {
    const res = await fetch(`${BASE}/internal/scheduler/assign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });
    if (!res.ok) return null;
    return res.json() as Promise<AssignResult>;
  } catch {
    return null;
  }
}

export async function releaseDriver(job_id: string): Promise<void> {
  try {
    await fetch(`${BASE}/internal/scheduler/release`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id }),
    });
  } catch { /* best-effort */ }
}
