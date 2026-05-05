/**
 * Dashboard Publisher — Publishes enriched events to waste.bin.dashboard.updates
 * This Kafka topic is consumed by the notification service and frontend
 */

import { Kafka, logLevel } from 'kafkajs';
import pino from 'pino';
import { DashboardUpdateEvent } from '../types';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

let kafkaProducer: any = null;

async function getProducer() {
  if (!kafkaProducer) {
    const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim());
    const user = process.env.KAFKA_USER;
    const pass = process.env.KAFKA_PASS;

    const kafka = new Kafka({
      clientId: 'bin-status-service-publisher',
      brokers,
      logLevel: logLevel.ERROR,
      ...(user && pass
        ? {
            sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
          }
        : {}),
    });

    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
  }

  return kafkaProducer;
}

export async function publishToDashboard(event: DashboardUpdateEvent): Promise<void> {
  try {
    const producer = await getProducer();

    const message = {
      key: event.payload.bin_id || event.payload.zone_id?.toString() || 'unknown',
      value: JSON.stringify(event),
      timestamp: new Date().getTime().toString(),
    };

    await producer.send({
      topic: 'waste.bin.dashboard.updates',
      messages: [message],
      timeout: 5000,
      compression: 1, // GZIP
    });

    logger.debug(
      { event_type: event.event_type, key: message.key },
      'Published to waste.bin.dashboard.updates',
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), event_type: event.event_type },
      'Failed to publish to dashboard topic',
    );
    // Do not throw — log and continue
  }
}

export async function disconnectProducer(): Promise<void> {
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
    kafkaProducer = null;
  }
}
