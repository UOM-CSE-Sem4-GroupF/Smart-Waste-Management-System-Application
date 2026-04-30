export type BinStatus = 'ok' | 'warning' | 'critical' | 'offline';
export type AlertType = 'urgent' | 'deviation' | 'escalated';
export type WasteType = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste';
export type ViewId = 'map' | 'bins' | 'jobs' | 'alerts' | 'analytics' | 'history';
export type JobType = 'routine' | 'emergency';
export type JobState =
  | 'CREATED' | 'BIN_CONFIRMING' | 'BIN_CONFIRMED'
  | 'CLUSTER_ASSEMBLING' | 'CLUSTER_ASSEMBLED'
  | 'DISPATCHING' | 'DISPATCHED'
  | 'DRIVER_NOTIFIED' | 'DRIVER_ACCEPTED'
  | 'IN_PROGRESS' | 'COMPLETING' | 'COLLECTION_DONE'
  | 'COMPLETED' | 'ESCALATED' | 'FAILED' | 'CANCELLED';

export interface Bin {
  id: string;
  label: string;
  zone: string;
  lat: number;
  lng: number;
  fill: number;                 // 0–100
  capacity: number;             // litres
  type: WasteType;
  status: BinStatus;
  urgency_score: number;        // 0–100
  estimated_weight_kg: number;
  battery: number;              // 0–100
  offline: boolean;
  lastPing: number;             // epoch ms
}

export interface Job {
  id: string;
  job_type: JobType;
  state: JobState;
  zone_id: string;
  zone_name: string;
  vehicle_id: string;
  driver_id: string;
  total_bins: number;
  bins_collected: number;
  bins_skipped?: number;
  planned_weight_kg: number;
  cargo_weight_kg: number;
  cargo_limit_kg: number;
  clusters: string[];
  created_at: string;
  completed_at?: string;
  actual_weight_kg?: number;
  duration_minutes?: number;
  state_history: Array<{ state: string; ts: string }>;
}

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  zone_id?: number;
  bin_id?: string;
  vehicle_id?: string;
  job_id?: string;
  received_at: string;
  acknowledged: boolean;
}

export interface RouteStop {
  binId: string;
  order: number;
  eta: string;
}

export interface Route {
  id: string;
  label: string;
  driver: string;
  vehicle: string;
  stops: RouteStop[];
  distanceKm: number;
  durationMin: number;
  status: 'pending' | 'active' | 'complete';
}

export interface Vehicle {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  routeId?: string;
  lastUpdate: number;
  cargo_utilisation_pct?: number;
  bins_collected?: number;
  bins_total?: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  binCount: number;
  avgFill?: number;
}

export interface AnalyticsData {
  weeklyCollections: { day: string; count: number }[];
  fillRateByZone: { zone: string; avg: number }[];
  alertsByType: { type: string; count: number }[];
  totalCollectionsThisMonth: number;
  avgFillOnCollection: number;
  fuelSavedLitres: number;
  co2SavedKg: number;
}

export const STATUS_COLOURS = {
  normal:   { bg: '#22C55E', text: '#166534', label: 'Normal'   },
  monitor:  { bg: '#EAB308', text: '#854D0E', label: 'Monitor'  },
  urgent:   { bg: '#F97316', text: '#7C2D12', label: 'Urgent'   },
  critical: { bg: '#EF4444', text: '#7F1D1D', label: 'Critical' },
  offline:  { bg: '#6B7280', text: '#1F2937', label: 'Offline'  },
} as const;

export const CATEGORY_COLOURS: Record<WasteType, string> = {
  food_waste: '#8B4513',
  paper:      '#4169E1',
  glass:      '#228B22',
  plastic:    '#FF6347',
  general:    '#808080',
  e_waste:    '#FFD700',
};

export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:            '#6B7280',
  BIN_CONFIRMING:     '#8B5CF6',
  BIN_CONFIRMED:      '#8B5CF6',
  CLUSTER_ASSEMBLING: '#8B5CF6',
  CLUSTER_ASSEMBLED:  '#8B5CF6',
  DISPATCHING:        '#3B82F6',
  DISPATCHED:         '#3B82F6',
  DRIVER_NOTIFIED:    '#EAB308',
  DRIVER_ACCEPTED:    '#EAB308',
  IN_PROGRESS:        '#22C55E',
  COMPLETING:         '#22C55E',
  COLLECTION_DONE:    '#10B981',
  COMPLETED:          '#6B7280',
  ESCALATED:          '#EF4444',
  FAILED:             '#EF4444',
  CANCELLED:          '#6B7280',
};

export const ACTIVE_JOB_STATES: JobState[] = [
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED',
  'DRIVER_NOTIFIED', 'DRIVER_ACCEPTED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE',
  'ESCALATED',
];

export const TERMINAL_JOB_STATES: JobState[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
