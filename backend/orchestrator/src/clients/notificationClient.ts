const BASE = process.env.NOTIFICATION_URL ?? 'http://notification:3004';

export async function notifyDashboard(event_type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${BASE}/internal/notify/${event_type}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch {
    // non-blocking — dashboard notification is best-effort
  }
}
