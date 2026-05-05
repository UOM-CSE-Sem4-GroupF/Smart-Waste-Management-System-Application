import { describe, it, expect } from 'vitest';
import { validateTransition, CANCELLABLE_STATES, TERMINAL_STATES } from '../core/stateMachine';

describe('validateTransition', () => {
  it('allows CREATED → BIN_CONFIRMING (emergency path)', () => {
    expect(() => validateTransition('CREATED', 'BIN_CONFIRMING')).not.toThrow();
  });

  it('allows CREATED → CLUSTER_ASSEMBLING (routine path)', () => {
    expect(() => validateTransition('CREATED', 'CLUSTER_ASSEMBLING')).not.toThrow();
  });

  it('allows the full emergency happy path', () => {
    const path: [string, string][] = [
      ['CREATED',            'BIN_CONFIRMING'],
      ['BIN_CONFIRMING',     'BIN_CONFIRMED'],
      ['BIN_CONFIRMED',      'CLUSTER_ASSEMBLING'],
      ['CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED'],
      ['CLUSTER_ASSEMBLED',  'DISPATCHING'],
      ['DISPATCHING',        'DISPATCHED'],
      ['DISPATCHED',         'DRIVER_NOTIFIED'],
      ['DRIVER_NOTIFIED',    'IN_PROGRESS'],
      ['IN_PROGRESS',        'COMPLETING'],
      ['COMPLETING',         'COLLECTION_DONE'],
      ['COLLECTION_DONE',    'RECORDING_AUDIT'],
      ['RECORDING_AUDIT',    'AUDIT_RECORDED'],
      ['AUDIT_RECORDED',     'COMPLETED'],
    ];
    for (const [from, to] of path) {
      expect(() => validateTransition(from, to), `${from} → ${to}`).not.toThrow();
    }
  });

  it('allows DISPATCHING → ESCALATED', () => {
    expect(() => validateTransition('DISPATCHING', 'ESCALATED')).not.toThrow();
  });

  it('allows RECORDING_AUDIT → AUDIT_FAILED', () => {
    expect(() => validateTransition('RECORDING_AUDIT', 'AUDIT_FAILED')).not.toThrow();
  });

  it('allows AUDIT_FAILED → COMPLETED (failure does not block completion)', () => {
    expect(() => validateTransition('AUDIT_FAILED', 'COMPLETED')).not.toThrow();
  });

  it('allows BIN_CONFIRMING → CANCELLED', () => {
    expect(() => validateTransition('BIN_CONFIRMING', 'CANCELLED')).not.toThrow();
  });

  it('throws on backwards transition', () => {
    expect(() => validateTransition('IN_PROGRESS', 'CREATED')).toThrow();
  });

  it('throws on skipping states (CREATED → IN_PROGRESS)', () => {
    expect(() => validateTransition('CREATED', 'IN_PROGRESS')).toThrow();
  });

  it('throws on transition from terminal COMPLETED', () => {
    expect(() => validateTransition('COMPLETED', 'IN_PROGRESS')).toThrow('Invalid transition: COMPLETED → IN_PROGRESS');
  });

  it('throws on unknown from-state', () => {
    expect(() => validateTransition('UNKNOWN_STATE', 'CREATED')).toThrow();
  });
});

describe('CANCELLABLE_STATES', () => {
  it('includes all pre-dispatch states', () => {
    for (const s of ['CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED', 'CLUSTER_ASSEMBLING', 'DISPATCHING', 'DRIVER_NOTIFIED']) {
      expect(CANCELLABLE_STATES).toContain(s);
    }
  });

  it('does not include IN_PROGRESS', () => {
    expect(CANCELLABLE_STATES).not.toContain('IN_PROGRESS');
  });
});

describe('TERMINAL_STATES', () => {
  it('contains all four terminal states', () => {
    expect(TERMINAL_STATES).toContain('COMPLETED');
    expect(TERMINAL_STATES).toContain('FAILED');
    expect(TERMINAL_STATES).toContain('ESCALATED');
    expect(TERMINAL_STATES).toContain('CANCELLED');
  });
});
