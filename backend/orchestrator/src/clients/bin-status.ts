const BASE = process.env.BIN_STATUS_URL ?? 'http://bin-status:3002';

export interface UrgencyConfirmation {
  bin_id:              string;
  confirmed:           boolean;
  urgency_score:       number;
  urgency_status:      string;
  estimated_weight_kg: number;
  fill_level_pct:      number;
  waste_category:      string;
}

export async function confirmUrgency(bin_id: string): Promise<UrgencyConfirmation | null> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${bin_id}/confirm-urgency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<UrgencyConfirmation>;
  } catch (e) {
    return null;
  }
}

export async function markCollected(bin_id: string, job_id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/internal/bins/${bin_id}/mark-collected`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id, collected_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
