import type { Alert } from '@/lib/types';

export const ALERTS: Alert[] = [
  { id: 'ALT-001', sev: 'critical', binId: 'BIN-001', msg: 'Fill level exceeded 80% — schedule pickup', ts: Date.now() - 1000 * 60 * 5, read: false },
  { id: 'ALT-002', sev: 'critical', binId: 'BIN-004', msg: 'Fill level at 91% — immediate pickup needed', ts: Date.now() - 1000 * 60 * 12, read: false },
  { id: 'ALT-003', sev: 'warning', binId: 'BIN-004', msg: 'Battery critically low (20%)', ts: Date.now() - 1000 * 60 * 18, read: false },
  { id: 'ALT-004', sev: 'warning', binId: 'BIN-002', msg: 'Fill level approaching 70% threshold', ts: Date.now() - 1000 * 60 * 30, read: true },
  { id: 'ALT-005', sev: 'info', binId: 'BIN-008', msg: 'Sensor offline — no ping for 15 minutes', ts: Date.now() - 1000 * 60 * 60, read: true },
  { id: 'ALT-006', sev: 'info', binId: 'BIN-003', msg: 'Scheduled maintenance due in 2 days', ts: Date.now() - 1000 * 60 * 90, read: true },
];
