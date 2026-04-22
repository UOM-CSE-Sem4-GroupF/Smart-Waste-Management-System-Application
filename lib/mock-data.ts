import type { Bin, Alert, Route, Zone, AnalyticsData } from './types';

export const ZONES: Zone[] = [
  { id: 'z1', name: 'Downtown Core',    color: '#22D3C5', binCount: 12 },
  { id: 'z2', name: 'Harbour District', color: '#60A5FA', binCount: 8  },
  { id: 'z3', name: 'East Suburbs',     color: '#A78BFA', binCount: 10 },
  { id: 'z4', name: 'Industrial South', color: '#FBBF24', binCount: 6  },
];

export const BINS: Bin[] = [
  { id: 'BIN-001', label: 'Main St & 1st Ave',    zone: 'z1', lat: 14.5995, lng: 120.9842, fill: 82, capacity: 240, type: 'general',   status: 'critical', battery: 78, offline: false, lastPing: Date.now() - 12000  },
  { id: 'BIN-002', label: 'Harbour Rd North',      zone: 'z2', lat: 14.5921, lng: 120.9763, fill: 65, capacity: 120, type: 'recycling', status: 'warning',  battery: 55, offline: false, lastPing: Date.now() - 8000   },
  { id: 'BIN-003', label: 'Plaza Central',          zone: 'z1', lat: 14.6020, lng: 120.9900, fill: 30, capacity: 360, type: 'organic',   status: 'ok',       battery: 92, offline: false, lastPing: Date.now() - 5000   },
  { id: 'BIN-004', label: 'East Park Entrance',     zone: 'z3', lat: 14.6110, lng: 121.0050, fill: 91, capacity: 240, type: 'general',   status: 'critical', battery: 20, offline: false, lastPing: Date.now() - 20000  },
  { id: 'BIN-005', label: 'Industrial Gate 3',      zone: 'z4', lat: 14.5730, lng: 120.9650, fill: 48, capacity: 660, type: 'hazardous', status: 'ok',       battery: 85, offline: false, lastPing: Date.now() - 3000   },
  { id: 'BIN-006', label: 'Harbour Ferry Terminal', zone: 'z2', lat: 14.5880, lng: 120.9710, fill: 55, capacity: 120, type: 'recycling', status: 'warning',  battery: 61, offline: false, lastPing: Date.now() - 15000  },
  { id: 'BIN-007', label: 'Riverside Walk',         zone: 'z1', lat: 14.6000, lng: 120.9780, fill: 12, capacity: 120, type: 'general',   status: 'ok',       battery: 99, offline: false, lastPing: Date.now() - 2000   },
  { id: 'BIN-008', label: 'Suburb Mall Parking',    zone: 'z3', lat: 14.6180, lng: 121.0100, fill: 0,  capacity: 240, type: 'general',   status: 'ok',       battery: 0,  offline: true,  lastPing: Date.now() - 900000 },
  { id: 'BIN-009', label: 'Market Row',             zone: 'z1', lat: 14.5960, lng: 120.9870, fill: 74, capacity: 240, type: 'organic',   status: 'warning',  battery: 43, offline: false, lastPing: Date.now() - 7000   },
  { id: 'BIN-010', label: 'Tech Park Block B',      zone: 'z3', lat: 14.6090, lng: 121.0020, fill: 35, capacity: 360, type: 'recycling', status: 'ok',       battery: 88, offline: false, lastPing: Date.now() - 4000   },
];

export const ALERTS: Alert[] = [
  { id: 'ALT-001', sev: 'critical', binId: 'BIN-001', msg: 'Fill level exceeded 80% — schedule pickup',   ts: Date.now() - 1000 * 60 * 5,  read: false },
  { id: 'ALT-002', sev: 'critical', binId: 'BIN-004', msg: 'Fill level at 91% — immediate pickup needed', ts: Date.now() - 1000 * 60 * 12, read: false },
  { id: 'ALT-003', sev: 'warning',  binId: 'BIN-004', msg: 'Battery critically low (20%)',                ts: Date.now() - 1000 * 60 * 18, read: false },
  { id: 'ALT-004', sev: 'warning',  binId: 'BIN-002', msg: 'Fill level approaching 70% threshold',        ts: Date.now() - 1000 * 60 * 30, read: true  },
  { id: 'ALT-005', sev: 'info',     binId: 'BIN-008', msg: 'Sensor offline — no ping for 15 minutes',     ts: Date.now() - 1000 * 60 * 60, read: true  },
  { id: 'ALT-006', sev: 'info',     binId: 'BIN-003', msg: 'Scheduled maintenance due in 2 days',         ts: Date.now() - 1000 * 60 * 90, read: true  },
];

export const ROUTE: Route = {
  id: 'RT-042',
  label: 'Morning Run — Zone 1 & 2',
  driver: 'R. Santos',
  vehicle: 'TRK-07',
  distanceKm: 18.4,
  durationMin: 95,
  status: 'active',
  stops: [
    { binId: 'BIN-001', order: 1, eta: '07:15' },
    { binId: 'BIN-009', order: 2, eta: '07:28' },
    { binId: 'BIN-007', order: 3, eta: '07:40' },
    { binId: 'BIN-003', order: 4, eta: '07:55' },
    { binId: 'BIN-002', order: 5, eta: '08:10' },
    { binId: 'BIN-006', order: 6, eta: '08:25' },
  ],
};

export const ANALYTICS: AnalyticsData = {
  weeklyCollections: [
    { day: 'Mon', count: 42 },
    { day: 'Tue', count: 38 },
    { day: 'Wed', count: 55 },
    { day: 'Thu', count: 47 },
    { day: 'Fri', count: 61 },
    { day: 'Sat', count: 29 },
    { day: 'Sun', count: 18 },
  ],
  fillRateByZone: [
    { zone: 'Downtown Core',    avg: 62 },
    { zone: 'Harbour District', avg: 58 },
    { zone: 'East Suburbs',     avg: 45 },
    { zone: 'Industrial South', avg: 48 },
  ],
  alertsByType: [
    { type: 'critical', count: 8  },
    { type: 'warning',  count: 21 },
    { type: 'info',     count: 14 },
  ],
  totalCollectionsThisMonth: 487,
  avgFillOnCollection: 76,
  fuelSavedLitres: 312,
  co2SavedKg: 748,
};