export type SocketRoom = 'dashboard-all' | 'fleet-ops' | 'alerts-all' | string;

// Job assignment from scheduler
export interface JobAssignedBody {
  driver_id: string;
  vehicle_id: string;
  job_id: string;
  job_type: 'routine' | 'emergency';
  clusters: Array<{ cluster_id: string; cluster_name: string; address: string }>;
  route: Array<{
    sequence: number;
    cluster_id: string;
    cluster_name: string;
    lat: number;
    lng: number;
    bins: string[];
    estimated_arrival: string;
  }>;
  estimated_duration_min: number;
  planned_weight_kg: number;
  total_bins: number;
}

// Job creation from orchestrator
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
  route: Array<{
    sequence: number;
    cluster_id: string;
    cluster_name: string;
    lat: number;
    lng: number;
    bins: string[];
    estimated_arrival: string;
  }>;
}

// Job completion from orchestrator
export interface JobCompletedBody {
  job_id: string;
  zone_id: number;
  vehicle_id: string;
  driver_id: string;
  bins_collected: number;
  bins_skipped: number;
  actual_weight_kg: number;
  duration_minutes: number;
  hyperledger_tx_id?: string;
}

// Job cancellation from orchestrator
export interface JobCancelledBody {
  job_id: string;
  zone_id: number;
  driver_id?: string;
  reason: string;
}

// Job escalation from orchestrator
export interface JobEscalatedBody {
  job_id: string;
  zone_id: number;
  reason: string;
  urgent_bins: Array<{ bin_id: string; urgency_score: number; predicted_full_at?: string }>;
  total_weight_kg: number;
}

// Vehicle position from scheduler (immediate)
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

// Alert for vehicle deviation from scheduler
export interface AlertDeviationBody {
  vehicle_id: string;
  driver_id: string;
  job_id: string;
  zone_id: number;
  deviation_metres: number;
  duration_seconds: number;
  message: string;
}

