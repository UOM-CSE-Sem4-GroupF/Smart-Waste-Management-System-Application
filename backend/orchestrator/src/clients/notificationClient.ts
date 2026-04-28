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

export const notifyJobCreated   = (body: unknown): Promise<boolean> => post('/internal/notify/job-created',   body);
export const notifyJobCompleted = (body: unknown): Promise<boolean> => post('/internal/notify/job-completed', body);
export const notifyJobEscalated = (body: unknown): Promise<boolean> => post('/internal/notify/job-escalated', body);
export const notifyJobCancelled = (body: unknown): Promise<boolean> => post('/internal/notify/job-cancelled', body);
