export interface Driver {
  driver_id:       string;
  name:            string;
  zone_id:         string;
  shift_start:     string;
  shift_end:       string;
  available:       boolean;
  current_job_id?: string;
  lat?:            number;
  lng?:            number;
}

export interface Vehicle {
  vehicle_id:       string;
  name:             string;
  max_cargo_kg:     number;
  waste_categories: string[];
  available:        boolean;
  current_job_id?:  string;
  lat:              number;
  lng:              number;
  heading:          number;
  speed_kmh:        number;
  last_update:      string;
}

export interface BinToCollect {
  bin_id:              string;
  cluster_id:          string;
  lat:                 number;
  lng:                 number;
  waste_category:      string;
  fill_level_pct:      number;
  estimated_weight_kg: number;
  urgency_score:       number;
  predicted_full_at:   string | null;
}

export interface ClusterRef {
  cluster_id:   string;
  lat:          number;
  lng:          number;
  cluster_name: string;
}

export interface DispatchRequest {
  job_id:                    string;
  clusters:                  ClusterRef[];
  bins_to_collect:           BinToCollect[];
  total_estimated_weight_kg: number;
  waste_category:            string;
  zone_id:                   number;
  priority:                  number;
}

export interface RouteWaypoint {
  cluster_id:           string;
  bins:                 string[];
  estimated_arrival:    string | null;
  cumulative_weight_kg: number;
}

export interface RoutePlan {
  id:                    string;
  job_id:                string;
  vehicle_id:            string;
  driver_id:             string;
  route_type:            string;
  zone_id:               number;
  waypoints:             RouteWaypoint[];
  total_bins:            number;
  estimated_weight_kg:   number;
  estimated_distance_km: number;
  estimated_minutes:     number;
  clusters:              ClusterRef[];
  bins_to_collect:       BinToCollect[];
  created_at:            string;
}

export interface BinCollectionRecord {
  job_id:                    string;
  bin_id:                    string;
  cluster_id:                string;
  lat:                       number;
  lng:                       number;
  sequence_number:           number;
  estimated_weight_kg:       number;
  actual_weight_kg?:         number;
  status:                    'pending' | 'collected' | 'skipped';
  planned_arrival_at:        string | null;
  arrived_at?:               string;
  collected_at?:             string;
  fill_level_at_collection?: number;
  gps_lat?:                  number;
  gps_lng?:                  number;
  notes?:                    string;
  photo_url?:                string;
  skipped_at?:               string;
  skip_reason?:              string;
  skip_notes?:               string;
}

export interface JobAssignment {
  job_id:            string;
  driver_id:         string;
  vehicle_id:        string;
  assigned_at:       string;
  planned_weight_kg: number;
}

export interface VehicleLocationEvent {
  version:        string;
  source_service: string;
  timestamp:      string;
  payload: {
    vehicle_id:      string;
    driver_id:       string;
    lat:             number;
    lng:             number;
    speed_kmh:       number;
    heading_degrees: number;
    accuracy_m:      number;
  };
}

export interface VehicleDeviationEvent {
  payload: {
    vehicle_id:       string;
    job_id:           string;
    deviation_metres: number;
    duration_seconds: number;
    current_lat:      number;
    current_lng:      number;
  };
}

export interface DispatchResult {
  success:           boolean;
  vehicle_id?:       string;
  driver_id?:        string;
  route_plan_id?:    string;
  estimated_minutes?: number;
  route?:            RouteWaypoint[];
  reason?:           string;
}
