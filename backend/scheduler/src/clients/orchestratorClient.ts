const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3001';

export async function notifyJobComplete(job_id: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${ORCHESTRATOR_URL}/internal/jobs/${job_id}/complete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
  } catch {
    // orchestrator unreachable — log and continue
    process.stdout.write(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', service: 'scheduler', message: `Could not notify orchestrator of job ${job_id} completion` }) + '\n',
    );
  }
}

export async function notifyVehicleFull(job_id: string): Promise<void> {
  try {
    await fetch(`${ORCHESTRATOR_URL}/internal/jobs/${job_id}/vehicle-full`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id }),
    });
  } catch {
    process.stdout.write(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', service: 'scheduler', message: `Could not notify orchestrator of vehicle-full for job ${job_id}` }) + '\n',
    );
  }
}
