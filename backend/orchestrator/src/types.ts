export type JobType = 'emergency' | 'routine';

export type JobState =
  | 'CREATED'
  | 'BIN_CONFIRMING'
  | 'BIN_CONFIRMED'
  | 'CLUSTER_ASSEMBLING'
  | 'CLUSTER_ASSEMBLED'
  | 'DISPATCHING'
  | 'DISPATCHED'
  | 'DRIVER_NOTIFIED'
  | 'IN_PROGRESS'
  | 'COMPLETING'
  | 'COLLECTION_DONE'
  | 'RECORDING_AUDIT'
  | 'AUDIT_RECORDED'
  | 'AUDIT_FAILED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ESCALATED'
  | 'CANCELLED';

export interface StateTransition {
  from_state: JobState | null;
  to_state:   JobState;
  reason?:    string;
  actor:      string;
  transitioned_at: string;
}

export interface StepResult {
  step_name:      string;
  attempt_number: number;
  success:        boolean;
  duration_ms:    number;
  error_message?: string;
  executed_at:    string;
}

export interface CollectionJob {
  job_id:                  string;
  job_type:                JobType;
  state:                   JobState;
  zone_id:                 string;
  waste_category:          string;
  trigger_bin_id?:         string;
  trigger_urgency_score?:  number;
  clusters:                string[];
  bins_to_collect:         string[];
  assigned_vehicle_id?:    string;
  assigned_driver_id?:     string;
  route_plan_id?:          string;
  planned_weight_kg?:      number;
  actual_weight_kg?:       number;
  actual_distance_km?:     number;
  actual_duration_min?:    number;
  hyperledger_tx_id?:      string;
  failure_reason?:         string;
  schedule_id?:            string;
  kafka_offset?:           number;
  created_at:              string;
  assigned_at?:            string;
  started_at?:             string;
  collection_done_at?:     string;
  completed_at?:           string;
}

export interface BinProcessedEvent {
  bin_id:              string;
  fill_level_pct:      number;
  urgency_score:       number;
  urgency_status?:     string;
  estimated_weight_kg?: number;
  waste_category?:     string;
  zone_id?:            string;
  cluster_id?:         string;
  latitude?:           number;
  longitude?:          number;
}

export interface RoutineScheduleTrigger {
  schedule_id?:        string;
  zone_id:             string | number;
  zone_name?:          string;
  waste_category_id?:  number | null;
  scheduled_date?:     string;
  scheduled_time?:     string;
  bin_ids?:            string[];
  route_plan_id?:      string;
  waste_category?:     string;
}

export interface ClusterBin {
  bin_id:               string;
  urgency_score:        number;
  estimated_weight_kg:  number;
  predicted_full_at:    string | null;
  should_collect:       boolean;
}

export interface ClusterSnapshot {
  cluster_id:                  string;
  bins:                        ClusterBin[];
  collectible_bins_weight_kg:  number;
}

export interface AssembleResult {
  cluster_ids:     string[];
  bin_ids:         string[];
  total_weight_kg: number;
}

export interface DispatchResult {
  success:        boolean;
  vehicle_id?:    string;
  driver_id?:     string;
  route_plan_id?: string;
  route?:         unknown;
  reason?:        string;
}

export interface JobCompleteRequest {
  job_id:          string;
  vehicle_id:      string;
  driver_id:       string;
  bins_collected:  Array<{
    bin_id:                    string;
    collected_at:              string;
    fill_level_at_collection:  number;
    actual_weight_kg?:         number;
    gps_lat:                   number;
    gps_lng:                   number;
  }>;
  bins_skipped:    Array<{
    bin_id:       string;
    skip_reason:  string;
  }>;
  actual_weight_kg:    number;
  actual_distance_km:  number;
  route_gps_trail:     Array<{ lat: number; lng: number; timestamp: string }>;
}

export interface UrgencyConfirmation {
  bin_id:              string;
  confirmed:           boolean;
  urgency_score:       number;
  urgency_status:      string;
  estimated_weight_kg: number;
  fill_level_pct:      number;
  waste_category:      string;
}
