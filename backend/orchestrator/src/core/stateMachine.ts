export const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:             ['BIN_CONFIRMING', 'CLUSTER_ASSEMBLING', 'CANCELLED', 'FAILED'],
  BIN_CONFIRMING:      ['BIN_CONFIRMED', 'CANCELLED', 'FAILED'],
  BIN_CONFIRMED:       ['CLUSTER_ASSEMBLING', 'CANCELLED', 'FAILED'],
  CLUSTER_ASSEMBLING:  ['CLUSTER_ASSEMBLED', 'CANCELLED', 'FAILED'],
  CLUSTER_ASSEMBLED:   ['DISPATCHING', 'CANCELLED', 'FAILED'],
  DISPATCHING:         ['DISPATCHED', 'ESCALATED', 'FAILED', 'CANCELLED'],
  DISPATCHED:          ['DRIVER_NOTIFIED', 'CANCELLED', 'FAILED'],
  DRIVER_NOTIFIED:     ['IN_PROGRESS', 'CANCELLED', 'FAILED'],
  IN_PROGRESS:         ['COMPLETING', 'CANCELLED'],
  COMPLETING:          ['COLLECTION_DONE'],
  COLLECTION_DONE:     ['RECORDING_AUDIT'],
  RECORDING_AUDIT:     ['AUDIT_RECORDED', 'AUDIT_FAILED'],
  AUDIT_RECORDED:      ['COMPLETED'],
  AUDIT_FAILED:        ['COMPLETED'],
  COMPLETED:           [],
  FAILED:              [],
  ESCALATED:           [],
  CANCELLED:           [],
};

export function validateTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'orchestrator:stateMachine',
      message: `Invalid state transition: ${from} → ${to}`,
      from_state: from,
      to_state: to,
      allowed_transitions: allowed,
    }) + '\n');
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}
