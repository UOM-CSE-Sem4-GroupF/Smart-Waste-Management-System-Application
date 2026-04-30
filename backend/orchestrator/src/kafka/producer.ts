import { Kafka, Producer, logLevel } from 'kafkajs';

let _producer: Producer | null = null;

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-producer',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function getProducer(): Promise<Producer> {
  if (!_producer) {
    _producer = buildKafka().producer();
    await _producer.connect();
  }
  return _producer;
}

export interface JobCompletedEvent {
  job_id:               string;
  job_type:             string;
  zone_id:              string;
  vehicle_id?:          string;
  driver_id?:           string;
  bins_collected_count: number;
  bins_skipped_count:   number;
  actual_weight_kg:     number;
  actual_distance_km:   number;
  duration_minutes?:    number;
  hyperledger_tx_id?:   string;
  completed_at:         string;
}

export async function publishJobCompleted(payload: JobCompletedEvent): Promise<void> {
  try {
    const producer = await getProducer();
    await producer.send({
      topic:    'waste.job.completed',
      messages: [{
        key:   payload.job_id,
        value: JSON.stringify({
          version:        '1.0',
          source_service: 'workflow-orchestrator',
          timestamp:      new Date().toISOString(),
          payload,
        }),
      }],
    });
  } catch (e) {
    // best-effort — log but don't fail job completion
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(), level: 'WARN',
      service: 'orchestrator', message: `Failed to publish waste.job.completed: ${e}`,
    }) + '\n');
  }
}
