import { Kafka, logLevel } from 'kafkajs';
import { BinProcessedPayload, RoutineScheduleTrigger, DriverResponsePayload } from '../types';
import { createJob, getJob } from '../store';
import { runStateMachine, handleDriverResponse } from '../state-machine/machine';

const slog = (level: string, msg: string, job_id?: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id }) + '\n');

function buildKafka() {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;

  return new Kafka({
    clientId: 'workflow-orchestrator',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function startKafkaConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator' });

  await consumer.connect();
  await consumer.subscribe({
    topics:        ['waste.bin.processed', 'waste.routine.schedule.trigger', 'waste.driver.responses'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const payload  = envelope.payload ?? envelope;

        switch (topic) {
          case 'waste.bin.processed': {
            const p = payload as BinProcessedPayload;
            if (Number(p.urgency_score) < 80) return;
            slog('INFO', `Emergency trigger: bin ${p.bin_id} urgency_score=${p.urgency_score}`);
            const job = createJob({
              job_type:       'emergency',
              zone_id:        p.zone_id        ?? 'unknown',
              waste_category: p.waste_category ?? 'general',
              bin_ids:        [p.bin_id],
              urgency_score:  Number(p.urgency_score),
            });
            runStateMachine(job).catch(e => slog('ERROR', `State machine error: ${e}`, job.job_id));
            break;
          }

          case 'waste.routine.schedule.trigger': {
            const p = payload as RoutineScheduleTrigger;
            slog('INFO', `Routine trigger: zone=${p.zone_id} date=${p.schedule_date}`);
            const job = createJob({
              job_type:       'routine',
              zone_id:        p.zone_id,
              waste_category: p.waste_category ?? 'general',
              bin_ids:        p.bin_ids ?? [],
              route_id:       p.route_id,
            });
            runStateMachine(job).catch(e => slog('ERROR', `State machine error: ${e}`, job.job_id));
            break;
          }

          case 'waste.driver.responses': {
            const p   = payload as DriverResponsePayload;
            const job = getJob(p.job_id);
            if (!job) { slog('WARN', `Driver response for unknown job ${p.job_id}`); return; }
            handleDriverResponse(job, p.response, p.reason)
              .catch(e => slog('ERROR', `Driver response error: ${e}`, p.job_id));
            break;
          }
        }
      } catch (e) {
        slog('ERROR', `Consumer error on ${topic}: ${e}`);
      }
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to 3 topics');
}
