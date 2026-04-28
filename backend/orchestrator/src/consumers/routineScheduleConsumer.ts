import { Kafka, logLevel } from 'kafkajs';
import * as db from '../db/queries';
import { executeRoutineWorkflow } from '../core/orchestrator';
import { RoutineScheduleTrigger } from '../types';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, ...extra }) + '\n');

function buildKafka(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? process.env.KAFKA_BROKER ?? 'localhost:9092').split(',');
  const user    = process.env.KAFKA_USER;
  const pass    = process.env.KAFKA_PASS;
  return new Kafka({
    clientId: 'workflow-orchestrator-routine',
    brokers,
    logLevel: logLevel.ERROR,
    ...(user && pass ? { sasl: { mechanism: 'scram-sha-256' as const, username: user, password: pass } } : {}),
  });
}

export async function startRoutineScheduleConsumer(): Promise<void> {
  const kafka    = buildKafka();
  const consumer = kafka.consumer({ groupId: 'workflow-orchestrator-routine' });

  await consumer.connect();
  await consumer.subscribe({ topics: ['waste.routine.schedule.trigger'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const msg     = JSON.parse(message.value.toString()) as RoutineScheduleTrigger;
        const trigger = msg.payload ?? (msg as unknown as RoutineScheduleTrigger['payload']);

        slog('INFO', `Routine trigger: zone=${trigger.zone_id} date=${trigger.scheduled_date}`);

        const job = db.createJob({
          job_type:       'routine',
          zone_id:        Number(trigger.zone_id),
          zone_name:      trigger.zone_name,
          schedule_id:    trigger.schedule_id,
          scheduled_date: trigger.scheduled_date,
          scheduled_time: trigger.scheduled_time,
          route_plan_id:  trigger.route_plan_id,
          priority:       3,
        });

        slog('INFO', `Routine job ${job.id} created`, { job_id: job.id });

        executeRoutineWorkflow(job.id, trigger).catch(e => {
          slog('ERROR', `Routine workflow failed: ${(e as Error).message}`, { job_id: job.id });
          db.updateJobState(job.id, 'FAILED');
          db.updateJob(job.id, { failure_reason: (e as Error).message });
        });

      } catch (e) {
        slog('ERROR', `routineSchedule consumer error: ${e}`);
      }
    },
  });

  slog('INFO', 'routineSchedule consumer ready — group=workflow-orchestrator-routine');
}
