const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:            ['BIN_CONFIRMING', 'CLUSTER_ASSEMBLING'],
  BIN_CONFIRMING:     ['BIN_CONFIRMED', 'CANCELLED'],
  BIN_CONFIRMED:      ['CLUSTER_ASSEMBLING'],
  CLUSTER_ASSEMBLING: ['CLUSTER_ASSEMBLED'],
  CLUSTER_ASSEMBLED:  ['DISPATCHING'],
  DISPATCHING:        ['DISPATCHED', 'ESCALATED', 'FAILED'],
  DISPATCHED:         ['DRIVER_NOTIFIED'],
  DRIVER_NOTIFIED:    ['IN_PROGRESS'],
  IN_PROGRESS:        ['COMPLETING', 'SPLIT_JOB', 'CANCELLED'],
  COMPLETING:         ['COLLECTION_DONE'],
  COLLECTION_DONE:    ['RECORDING_AUDIT'],
  RECORDING_AUDIT:    ['AUDIT_RECORDED', 'AUDIT_FAILED'],
  AUDIT_RECORDED:     ['COMPLETED'],
  AUDIT_FAILED:       ['COMPLETED'],
  SPLIT_JOB:          ['DISPATCHING'],
  COMPLETED:          [],
  FAILED:             [],
  ESCALATED:          [],
  CANCELLED:          [],
};

export function validateTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

export const CANCELLABLE_STATES = [
  'CREATED',
  'BIN_CONFIRMING',
  'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING',
  'CLUSTER_ASSEMBLED',
  'DISPATCHING',
  'DISPATCHED',
  'DRIVER_NOTIFIED',
] as const;

export const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'ESCALATED', 'CANCELLED'] as const;
