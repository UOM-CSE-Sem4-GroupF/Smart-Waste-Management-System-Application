import pino from 'pino';
import { DashboardUpdateEvent } from '../types';
import { createManualProducer, ManualProducer } from './manualProducer';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let producer: ManualProducer | null = null;
let initPromise: Promise<ManualProducer> | null = null;

async function getProducer(): Promise<ManualProducer> {
  if (producer) return producer;
  if (!initPromise) {
    initPromise = createManualProducer('bin-status-service-publisher').then(p => {
      producer = p;
      return p;
    }).catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function initPublisher(): Promise<void> {
  await getProducer();
}

export async function publishToDashboard(event: DashboardUpdateEvent): Promise<void> {
  const maxRetries = 5;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const p = await getProducer();
      const key = (event.payload as any).bin_id ?? (event.payload as any).zone_id ?? null;
      await p.send('waste.bin.dashboard.updates', key ? String(key) : null, JSON.stringify(event));
      logger.debug({ event_type: event.event_type }, 'Published to waste.bin.dashboard.updates');
      return; // Success
    } catch (error) {
      lastError = error;
      logger.warn(
        { error: error instanceof Error ? error.message : String(error), event_type: event.event_type, attempt },
        'Transient failure publishing to waste.bin.dashboard.updates, retrying...',
      );
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }

  logger.error(
    { error: lastError instanceof Error ? lastError.message : String(lastError), event_type: event.event_type },
    'Failed to publish to waste.bin.dashboard.updates after retries',
  );
  throw lastError; // Let the caller decide how to handle complete failure
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect().catch(() => {});
    producer = null;
    initPromise = null;
  }
}

