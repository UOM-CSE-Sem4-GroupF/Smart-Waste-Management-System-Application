import { DispatchResult } from '../types';

const BASE = process.env.SCHEDULER_URL ?? 'http://scheduler:3003';

export async function dispatch(params: {
  job_id: string;
  clusters: string[];
  bins_to_collect: string[];
  total_estimated_weight_kg: number;
  waste_category: string;
  zone_id: number;
  priority: number;
}): Promise<DispatchResult> {
  const res = await fetch(`${BASE}/internal/scheduler/dispatch`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Scheduler dispatch failed: HTTP ${res.status}`);
  return res.json() as Promise<DispatchResult>;
}

export async function release(jobId: string): Promise<void> {
  try {
    await fetch(`${BASE}/internal/scheduler/release`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id: jobId }),
    });
  } catch { /* best-effort */ }
}
