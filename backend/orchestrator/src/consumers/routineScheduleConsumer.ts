import { Kafka, logLevel } from 'kafkajs';
import { RoutineScheduleTrigger } from '../types';
import { insertJob } from '../db/queries';
import { executeRoutineWorkflow, handleWorkflowFailure } from '../core/orchestrator';

const slog = (level: string, msg: string, job_id?: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id,
  }) + '\n');
};

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-routine-consumer',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? {
      sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass },
    } : {}),
  });
}

export async function startRoutineScheduleConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator-routine' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'waste.routine.schedule.trigger', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        const trigger  = (envelope.payload ?? envelope) as RoutineScheduleTrigger;

        const zone_id      = String(trigger.zone_id);
        const waste_cat    = trigger.waste_category
          ?? (trigger.waste_category_id ? String(trigger.waste_category_id) : 'general');
        const bin_ids      = trigger.bin_ids ?? [];
        const route_plan_id = trigger.route_plan_id;

        slog('INFO', `Routine trigger: zone=${zone_id} bins=${bin_ids.length}`);

        const job = insertJob({
          job_type:       'routine',
          zone_id,
          waste_category: waste_cat,
          schedule_id:    trigger.schedule_id,
        });

        executeRoutineWorkflow(job, { zone_id, bin_ids, route_plan_id, waste_category: waste_cat })
          .catch(e => handleWorkflowFailure(job, e));

      } catch (e) {
        slog('ERROR', `routineScheduleConsumer error: ${e}`);
      }
    },
  });

  slog('INFO', 'Kafka consumer ready — subscribed to waste.routine.schedule.trigger');
}
