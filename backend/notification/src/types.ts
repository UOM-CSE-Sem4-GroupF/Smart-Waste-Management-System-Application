export interface RouteStop {
  sequence: number;
  cluster_id: string;
  cluster_name: string;
  lat: number;
  lng: number;
  bins: string[];
  estimated_arrival: string;
}

export interface ClusterRef {
  cluster_id: string;
  cluster_name: string;
  address: string;
}

export interface JobAssignedBody {
  driver_id: string;
  vehicle_id: string;
  job_id: string;
  job_type: 'routine' | 'emergency';
  clusters: ClusterRef[];
  route: RouteStop[];
  estimated_duration_min: number;
  planned_weight_kg: number;
  total_bins: number;
}

export interface JobCreatedBody {
  job_id: string;
  job_type: 'routine' | 'emergency';
  zone_id: number;
  zone_name: string;
  clusters: string[];
  vehicle_id: string;
  driver_id: string;
  total_bins: number;
  planned_weight_kg: number;
  priority: number;
  route: RouteStop[];
}

export interface JobCompletedBody {
  job_id: string;
  zone_id: number;
  vehicle_id: string;
  driver_id: string;
  bins_collected: number;
  bins_skipped: number;
  actual_weight_kg: number;
  duration_minutes: number;
  hyperledger_tx_id: string | null;
}

export interface JobEscalatedBody {
  job_id: string;
  zone_id: number;
  reason: string;
  urgent_bins: Array<{ bin_id: string; urgency_score: number; predicted_full_at: string }>;
  total_weight_kg: number;
}

export interface JobCancelledBody {
  job_id: string;
  zone_id: number;
  driver_id: string | null;
  reason: string;
}

export interface VehiclePositionBody {
  vehicle_id: string;
  driver_id: string;
  job_id: string;
  zone_id: number;
  lat: number;
  lng: number;
  speed_kmh: number;
  cargo_weight_kg: number;
  cargo_limit_kg: number;
  cargo_utilisation_pct: number;
  bins_collected: number;
  bins_total: number;
  arrived_at_cluster?: string;
  weight_limit_warning?: boolean;
}

export interface AlertDeviationBody {
  vehicle_id: string;
  driver_id: string;
  job_id: string;
  zone_id: number;
  deviation_metres: number;
  duration_seconds: number;
  message: string;
}

export interface DashboardUpdateEvent {
  event_type: 'bin:update' | 'zone:stats' | 'alert:urgent';
  payload: Record<string, unknown>;
}

export interface VehicleUpdateEvent {
  event_type: 'vehicle:position' | 'job:progress';
  payload: Record<string, unknown>;
}
