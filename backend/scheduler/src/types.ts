export enum VehicleType {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTRA_LARGE = 'extra_large'
}

export interface Vehicle {
  vehicle_id: string;
  name: string;
  max_cargo_kg: number;
  waste_categories_supported: string[];
  status: 'available' | 'dispatched' | 'in_progress' | 'maintenance';
  driver_id: string;
  lat: number;
  lng: number;
  zone_id: number;
}

export interface Driver {
  driver_id: string;
  name: string;
  vehicle_id: string;
  zone_id: number;
  status: 'available' | 'dispatched' | 'in_progress' | 'off_duty';
}

export interface Cluster {
  cluster_id: string;
  lat: number;
  lng: number;
  cluster_name: string;
}

export interface BinToCollect {
  bin_id: string;
  cluster_id: string;
  lat: number;
  lng: number;
  waste_category: string;
  fill_level_pct: number;
  estimated_weight_kg: number;
  urgency_score: number;
  predicted_full_at: string | null;
}

export interface DispatchRequest {
  job_id: string;
  clusters: Cluster[];
  bins_to_collect: BinToCollect[];
  total_estimated_weight_kg: number;
  waste_category: string;
  zone_id: number;
  priority: number;
}

export interface Waypoint {
  cluster_id: string;
  bins: string[];
  estimated_arrival: string | null;
  cumulative_weight_kg: number;
}

export interface RoutePlan {
  route_plan_id: string;
  job_id: string;
  vehicle_id: string;
  route_type: 'emergency' | 'routine';
  zone_id: number;
  waypoints: Waypoint[];
  total_bins: number;
  estimated_weight_kg: number;
  estimated_distance_km: number;
  estimated_minutes: number;
  created_at: string;
}

export interface BinCollectionRecord {
  job_id: string;
  bin_id: string;
  sequence_number: number;
  planned_arrival_at: string | null;
  arrived_at?: string;
  collected_at?: string;
  skipped_at?: string;
  skip_reason?: 'locked' | 'inaccessible' | 'already_empty' | 'hazardous' | 'bin_missing' | 'other';
  skip_notes?: string;
  estimated_weight_kg: number;
  actual_weight_kg?: number;
  fill_level_at_collection?: number;
  gps_lat?: number;
  gps_lng?: number;
  notes?: string;
  photo_url?: string;
}

export interface VehicleLocationEvent {
  version: string;
  source_service: 'flutter-app';
  timestamp: string;
  payload: {
    vehicle_id: string;
    driver_id: string;
    lat: number;
    lng: number;
    speed_kmh: number;
    heading_degrees: number;
    accuracy_m: number;
  };
}

export interface VehicleDeviationEvent {
  payload: {
    vehicle_id: string;
    job_id: string;
    deviation_metres: number;
    duration_seconds: number;
    current_lat: number;
    current_lng: number;
  };
}

export interface JobAssignedNotification {
  driver_id: string;
  vehicle_id: string;
  job_id: string;
  clusters: Cluster[];
  route: Waypoint[];
  estimated_duration_min: number;
}

export interface VehiclePositionUpdate {
  event_type: 'vehicle:position';
  vehicle_id: string;
  driver_id: string;
  job_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading_degrees: number;
  accuracy_m: number;
  current_cluster?: string;
  next_cluster?: string;
  bins_collected: number;
  bins_total: number;
  cargo_weight_kg: number;
  cargo_limit_kg: number;
  cargo_utilisation_pct: number;
  arrived_at_bin?: string;
  weight_limit_warning?: boolean;
}

export interface BinCollectedRequest {
  fill_level_at_collection: number;
  gps_lat: number;
  gps_lng: number;
  actual_weight_kg?: number;
  notes?: string;
  photo_url?: string;
}

export interface BinSkipRequest {
  reason: 'locked' | 'inaccessible' | 'already_empty' | 'hazardous' | 'bin_missing' | 'other';
  notes?: string;
}

export interface JobProgressResponse {
  job_id: string;
  state: string;
  vehicle_id: string;
  driver_id: string;
  driver_name: string;
  total_bins: number;
  bins_collected: number;
  bins_skipped: number;
  bins_pending: number;
  cargo_weight_kg: number;
  cargo_limit_kg: number;
  cargo_utilisation_pct: number;
  estimated_completion_at: string | null;
  current_stop: {
    cluster_id: string;
    cluster_name: string;
    bins_at_stop: number;
    bins_collected_at_stop: number;
  } | null;
  waypoints: Array<{
    sequence: number;
    cluster_id: string;
    cluster_name: string;
    bins: string[];
    status: 'completed' | 'current' | 'pending';
    arrived_at: string | null;
    completed_at: string | null;
  }>;
}

export interface ActiveVehiclesResponse {
  vehicles: Array<{
    vehicle_id: string;
    vehicle_type: string;
    driver_id: string;
    driver_name: string;
    job_id: string;
    job_type: string;
    zone_id: number;
    state: string;
    current_lat: number | null;
    current_lng: number | null;
    last_seen_at: string | null;
    cargo_weight_kg: number;
    cargo_limit_kg: number;
    cargo_utilisation_pct: number;
    bins_collected: number;
    bins_total: number;
  }>;
}

export interface AvailableDriversResponse {
  drivers: Array<{
    driver_id: string;
    driver_name: string;
    vehicle_id: string;
    vehicle_type: string;
    zone_id: number;
    status: string;
  }>;
}
