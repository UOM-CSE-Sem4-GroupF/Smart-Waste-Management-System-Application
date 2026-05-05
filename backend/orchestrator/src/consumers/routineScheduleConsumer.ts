import { RoutineScheduleTrigger } from '../types';
import { insertJob } from '../db/queries';
import { executeRoutineWorkflow, handleWorkflowFailure } from '../core/orchestrator';
import { startManualConsumer } from './manualConsumer';

const slog = (level: string, msg: string, job_id?: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg, job_id,
  }) + '\n');
};

export async function startRoutineScheduleConsumer(): Promise<void> {
  await startManualConsumer(
    'workflow-orchestrator-routine-consumer',
    'waste.routine.schedule.trigger',
    async (value) => {
      try {
        const envelope = JSON.parse(value.toString());
        const trigger  = (envelope.payload ?? envelope) as RoutineScheduleTrigger;

        const zone_id       = String(trigger.zone_id);
        const waste_cat     = trigger.waste_category
          ?? (trigger.waste_category_id ? String(trigger.waste_category_id) : 'general');
        const bin_ids       = trigger.bin_ids ?? [];
        const route_plan_id = trigger.route_plan_id;

        slog('INFO', `Routine trigger: zone=${zone_id} bins=${bin_ids.length}`);

        const job = await insertJob({
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
    (level, msg) => slog(level, msg),
  );

  slog('INFO', 'Kafka consumer ready — subscribed to waste.routine.schedule.trigger');
}
