import type { Bin, Alert, Route, Zone, AnalyticsData } from './types';

export const ZONES: Zone[] = [
  { id: 'z1', name: 'Downtown Core',    color: '#22D3C5', binCount: 12 },
  { id: 'z2', name: 'Harbour District', color: '#60A5FA', binCount: 8  },
  { id: 'z3', name: 'East Suburbs',     color: '#A78BFA', binCount: 10 },
  { id: 'z4', name: 'Industrial South', color: '#FBBF24', binCount: 6  },
];

export const BINS: Bin[] = [
  { id: 'BIN-001', label: 'Main St & 1st Ave',    zone: 'z1', lat: 14.5995, lng: 120.9842, fill: 82, capacity: 240, type: 'general',   status: 'critical', urgency_score: 85, estimated_weight_kg: 29.5, battery: 78, offline: false, lastPing: Date.now() - 12000  },
  { id: 'BIN-002', label: 'Harbour Rd North',      zone: 'z2', lat: 14.5921, lng: 120.9763, fill: 65, capacity: 120, type: 'paper',     status: 'warning',  urgency_score: 60, estimated_weight_kg: 7.8,  battery: 55, offline: false, lastPing: Date.now() - 8000   },
  { id: 'BIN-003', label: 'Plaza Central',          zone: 'z1', lat: 14.6020, lng: 120.9900, fill: 30, capacity: 360, type: 'food_waste',status: 'ok',       urgency_score: 20, estimated_weight_kg: 27.0, battery: 92, offline: false, lastPing: Date.now() - 5000   },
  { id: 'BIN-004', label: 'East Park Entrance',     zone: 'z3', lat: 14.6110, lng: 121.0050, fill: 91, capacity: 240, type: 'general',   status: 'critical', urgency_score: 92, estimated_weight_kg: 32.8, battery: 20, offline: false, lastPing: Date.now() - 20000  },
  { id: 'BIN-005', label: 'Industrial Gate 3',      zone: 'z4', lat: 14.5730, lng: 120.9650, fill: 48, capacity: 660, type: 'e_waste',   status: 'ok',       urgency_score: 35, estimated_weight_kg: 63.5, battery: 85, offline: false, lastPing: Date.now() - 3000   },
  { id: 'BIN-006', label: 'Harbour Ferry Terminal', zone: 'z2', lat: 14.5880, lng: 120.9710, fill: 55, capacity: 120, type: 'glass',     status: 'warning',  urgency_score: 55, estimated_weight_kg: 165.0,battery: 61, offline: false, lastPing: Date.now() - 15000  },
  { id: 'BIN-007', label: 'Riverside Walk',         zone: 'z1', lat: 14.6000, lng: 120.9780, fill: 12, capacity: 120, type: 'general',   status: 'ok',       urgency_score: 8,  estimated_weight_kg: 2.2,  battery: 99, offline: false, lastPing: Date.now() - 2000   },
  { id: 'BIN-008', label: 'Suburb Mall Parking',    zone: 'z3', lat: 14.6180, lng: 121.0100, fill: 0,  capacity: 240, type: 'general',   status: 'offline',  urgency_score: 0,  estimated_weight_kg: 0,    battery: 0,  offline: true,  lastPing: Date.now() - 900000 },
  { id: 'BIN-009', label: 'Market Row',             zone: 'z1', lat: 14.5960, lng: 120.9870, fill: 74, capacity: 240, type: 'food_waste',status: 'warning',  urgency_score: 72, estimated_weight_kg: 44.4, battery: 43, offline: false, lastPing: Date.now() - 7000   },
  { id: 'BIN-010', label: 'Tech Park Block B',      zone: 'z3', lat: 14.6090, lng: 121.0020, fill: 35, capacity: 360, type: 'plastic',   status: 'ok',       urgency_score: 22, estimated_weight_kg: 6.3,  battery: 88, offline: false, lastPing: Date.now() - 4000   },
];

export const ALERTS: Alert[] = [
  { id: 'ALT-001', type: 'urgent',    bin_id: 'BIN-001', message: 'Fill level exceeded 80% — schedule pickup',   zone_id: 1, received_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),  acknowledged: false },
  { id: 'ALT-002', type: 'urgent',    bin_id: 'BIN-004', message: 'Fill level at 91% — immediate pickup needed', zone_id: 3, received_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), acknowledged: false },
  { id: 'ALT-003', type: 'deviation', vehicle_id: 'LORRY-03', message: 'Vehicle 650m off planned route',         zone_id: 3, received_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), acknowledged: false },
  { id: 'ALT-004', type: 'urgent',    bin_id: 'BIN-002', message: 'Fill level approaching 70% threshold',        zone_id: 2, received_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), acknowledged: true  },
  { id: 'ALT-005', type: 'escalated', job_id: 'job-abc', message: 'No vehicle available for Zone 1 emergency',  zone_id: 1, received_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), acknowledged: true  },
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
    { type: 'urgent',    count: 8  },
    { type: 'deviation', count: 5  },
    { type: 'escalated', count: 3  },
  ],
  totalCollectionsThisMonth: 487,
  avgFillOnCollection: 76,
  fuelSavedLitres: 312,
  co2SavedKg: 748,
};
