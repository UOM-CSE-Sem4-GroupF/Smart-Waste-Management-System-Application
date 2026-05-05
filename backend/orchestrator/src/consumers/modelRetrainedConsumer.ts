import { startManualConsumer } from './manualConsumer';

const slog = (level: string, msg: string): void => {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(), level, service: 'orchestrator', message: msg,
  }) + '\n');
};

export async function startModelRetrainedConsumer(): Promise<void> {
  await startManualConsumer(
    'workflow-orchestrator-model-consumer',
    'waste.model.retrained',
    async () => {
      slog('INFO', 'Model retrained event received — no action taken by orchestrator');
    },
    (level, msg) => slog(level, msg),
  );

  slog('INFO', 'Kafka consumer ready — subscribed to waste.model.retrained');
}
