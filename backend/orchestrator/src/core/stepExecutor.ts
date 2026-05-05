import * as db from '../db/queries';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, ...extra }) + '\n');

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function step<T>(
  jobId: string,
  stepName: string,
  serviceCall: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const retries      = options.retries      ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 5_000;
  const startTime    = Date.now();

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result   = await serviceCall();
      const duration = Date.now() - startTime;

      db.insertStepResult({
        job_id: jobId, step_name: stepName,
        attempt_number: attempt, success: true, duration_ms: duration,
      });
      return result;

    } catch (error) {
      lastError      = error as Error;
      const duration = Date.now() - startTime;

      db.insertStepResult({
        job_id: jobId, step_name: stepName,
        attempt_number: attempt, success: false,
        duration_ms: duration, error_message: lastError.message,
      });

      if (attempt < retries) {
        const backoff = retryDelayMs * Math.pow(2, attempt - 1);
        slog('WARN', `Step ${stepName} attempt ${attempt} failed, retrying in ${backoff}ms`, { job_id: jobId });
        await sleep(backoff);
      }
    }
  }

  throw lastError ?? new Error(`Step ${stepName} failed after ${retries} attempts`);
}
