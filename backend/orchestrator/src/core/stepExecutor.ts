import { CollectionJob } from '../types';
import { recordStep } from '../db/queries';

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function step<T>(
  job: CollectionJob,
  stepName: string,
  serviceCall: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const retries      = options.retries      ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 5_000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const result = await serviceCall();
      recordStep(job, stepName, attempt, true, Date.now() - start);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const msg = error instanceof Error ? error.message : String(error);
      recordStep(job, stepName, attempt, false, duration, msg);

      if (attempt < retries) {
        const backoff = retryDelayMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }

  // TypeScript requires exhaustive return — unreachable since the loop always returns or throws
  throw new Error(`step: exhausted ${retries} retries for ${stepName}`);
}
