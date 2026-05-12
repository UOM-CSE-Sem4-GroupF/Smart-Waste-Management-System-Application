const BASE = process.env.NOTIFICATION_URL ?? 'http://notification:3004';
const SERVICE_HEADER = { 'Content-Type': 'application/json' };

const slog = (level: string, msg: string, extra?: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator:notificationClient', message: msg, ...extra,
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

export async function notifyDashboard(event_type: string, payload: Record<string, unknown>): Promise<void> {
  const url = `${BASE}/internal/notify/${event_type}`;

  slog('DEBUG', `notifyDashboard: emitting ${event_type}`, {
    event_type,
    url,
    job_id:   payload.job_id,
    zone_id:  payload.zone_id,
    ...(payload.vehicle_id  ? { vehicle_id:  payload.vehicle_id }  : {}),
    ...(payload.driver_id   ? { driver_id:   payload.driver_id }   : {}),
    ...(payload.cluster_id  ? { cluster_id:  payload.cluster_id }  : {}),
  });

  try {
    const res = await timedFetch(`notify-${event_type}`, url, {
      method:  'POST',
      headers: SERVICE_HEADER,
      body:    JSON.stringify(payload),
    });

    if (res.ok) {
      slog('DEBUG', `notifyDashboard: ${event_type} delivered`, { event_type, job_id: payload.job_id });
    } else {
      slog('WARN', `notifyDashboard: notification service returned ${res.status} for ${event_type}`, {
        event_type,
        status: res.status,
        job_id: payload.job_id,
      });
    }
  } catch (e) {
    slog('WARN', `notifyDashboard: exception emitting ${event_type}: ${(e as Error).message}`, {
      event_type,
      job_id: payload.job_id,
    });
    // non-blocking — dashboard notification is best-effort
  }
}
