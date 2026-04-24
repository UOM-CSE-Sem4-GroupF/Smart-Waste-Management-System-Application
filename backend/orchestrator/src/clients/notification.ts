const BASE = process.env.NOTIFICATION_URL ?? 'http://notification:3004';

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const notifyJobAssigned  = (body: unknown): Promise<boolean> => post('/internal/notify/job-assigned',  body);
export const notifyJobCancelled = (body: unknown): Promise<boolean> => post('/internal/notify/job-cancelled', body);
export const notifyRouteUpdated = (body: unknown): Promise<boolean> => post('/internal/notify/route-updated', body);
export const notifyJobEscalated = (body: unknown): Promise<boolean> => post('/internal/notify/job-escalated', body);
