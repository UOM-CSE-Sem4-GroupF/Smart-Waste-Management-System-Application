export const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:             ['BIN_CONFIRMING', 'CLUSTER_ASSEMBLING'],
  BIN_CONFIRMING:      ['BIN_CONFIRMED', 'CANCELLED'],
  BIN_CONFIRMED:       ['CLUSTER_ASSEMBLING'],
  CLUSTER_ASSEMBLING:  ['CLUSTER_ASSEMBLED'],
  CLUSTER_ASSEMBLED:   ['DISPATCHING'],
  DISPATCHING:         ['DISPATCHED', 'ESCALATED', 'FAILED'],
  DISPATCHED:          ['DRIVER_NOTIFIED'],
  DRIVER_NOTIFIED:     ['IN_PROGRESS'],
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
