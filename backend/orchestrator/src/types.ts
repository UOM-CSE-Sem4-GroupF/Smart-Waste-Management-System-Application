export type JobType = 'emergency' | 'routine';

export type JobState =
  | 'CREATED'
  | 'BIN_CONFIRMING'
  | 'BIN_CONFIRMED'
  | 'ROUTE_LOADING'
  | 'ROUTE_LOADED'
  | 'ASSIGNING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'NOTIFYING_DRIVER'
  | 'DRIVER_NOTIFIED'
  | 'AWAITING_ACCEPTANCE'
  | 'DRIVER_ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETING'
  | 'COLLECTION_DONE'
  | 'RECORDING_AUDIT'
  | 'AUDIT_RECORDED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ESCALATED'
  | 'CANCELLED'
  | 'DRIVER_REASSIGNMENT';

export interface StateTransition {
  from:     JobState;
  to:       JobState;
  at:       string;
  reason?:  string;
}

export interface StepResult {
  step:     string;
  success:  boolean;
  at:       string;
  detail?:  unknown;
}

export interface CollectionJob {
  job_id:                  string;
  job_type:                JobType;
  state:                   JobState;
  zone_id:                 string;
  waste_category:          string;
  bin_ids:                 string[];
  urgency_score?:          number;
  route_id?:               string;
  driver_id?:              string;
  vehicle_id?:             string;
  planned_weight_kg?:      number;
  driver_rejection_count:  number;
  created_at:              string;
  updated_at:              string;
  completed_at?:           string;
  state_history:           StateTransition[];
  step_results:            StepResult[];
}

export interface BinProcessedPayload {
  bin_id:              string;
  fill_level_pct:      number;
  urgency_score:       number;
  urgency_status?:     string;
  estimated_weight_kg?: number;
  waste_category?:     string;
  zone_id?:            string;
}

export interface RoutineScheduleTrigger {
  zone_id:        string;
  schedule_date:  string;
  bin_ids?:       string[];
  route_id?:      string;
  waste_category?: string;
}

export interface DriverResponsePayload {
  job_id:    string;
  driver_id: string;
  response:  'accepted' | 'rejected';
  reason?:   string;
}
