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

export async function publishToDashboard(event: DashboardUpdateEvent): Promise<void> {
  try {
    const p = await getProducer();
    const key = (event.payload as any).bin_id ?? (event.payload as any).zone_id ?? null;
    await p.send('waste.bin.dashboard.updates', key ? String(key) : null, JSON.stringify(event));
    logger.debug({ event_type: event.event_type }, 'Published to waste.bin.dashboard.updates');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), event_type: event.event_type },
      'Failed to publish to waste.bin.dashboard.updates',
    );
  }
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect().catch(() => {});
    producer = null;
    initPromise = null;
  }
}
