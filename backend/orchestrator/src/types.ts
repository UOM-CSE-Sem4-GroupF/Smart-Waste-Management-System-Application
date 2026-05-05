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
  | 'CANCELLED'
  | 'SPLIT_JOB';

export interface BinCollectionRecord {
  bin_id: string;
  cluster_id?: string;
  sequence_number: number;
  status: 'pending' | 'collected' | 'skipped';
  collected_at?: string;
  fill_level_at_collection?: number;
  estimated_weight_kg: number;
  actual_weight_kg?: number;
  skip_reason?: string;
}

export interface StateTransitionRecord {
  job_id: string;
  from_state: string | null;
  to_state: string;
  reason?: string;
  actor: string;
  transitioned_at: string;
}

export interface StepResultRecord {
  job_id: string;
  step_name: string;
  attempt_number: number;
  success: boolean;
  duration_ms: number;
  error_message?: string;
  executed_at: string;
}

export interface CollectionJob {
  id: string;
  job_type: JobType;
  zone_id: number;
  zone_name?: string;
  state: JobState;
  priority: number;
  trigger_bin_id?: string;
  trigger_urgency_score?: number;
  trigger_waste_category?: string;
  schedule_id?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  route_plan_id?: string;
  clusters: string[];
  bins_to_collect: string[];
  planned_weight_kg?: number;
  planned_distance_km?: number;
  planned_duration_min?: number;
  assigned_vehicle_id?: string;
  assigned_driver_id?: string;
  assigned_at?: string;
  started_at?: string;
  collection_done_at?: string;
  completed_at?: string;
  escalated_at?: string;
  actual_weight_kg?: number;
  actual_distance_km?: number;
  actual_duration_min?: number;
  hyperledger_tx_id?: string;
  failure_reason?: string;
  kafka_offset?: string;
  created_at: string;
  updated_at: string;
}

// ── Kafka event types ─────────────────────────────────────────────────────────

export interface BinProcessedEvent {
  bin_id: string;
  cluster_id: string;
  urgency_score: number;
  urgency_status?: string;
  fill_level_pct: number;
  waste_category: string;
  zone_id: number;
  predicted_full_at?: string;
}

export interface RoutineScheduleTrigger {
  version?: string;
  source_service?: string;
  timestamp?: string;
  payload: {
    schedule_id: string;
    zone_id: number;
    zone_name: string;
    waste_category_id?: number | null;
    scheduled_date: string;
    scheduled_time: string;
    bin_ids: string[];
    route_plan_id: string;
  };
}

// ── Bin-status-service response types ────────────────────────────────────────

export interface ClusterBin {
  bin_id: string;
  fill_level_pct: number;
  urgency_score: number;
  should_collect: boolean;
  predicted_full_at?: string;
  estimated_weight_kg: number;
}

export interface ClusterSnapshot {
  cluster_id: string;
  zone_id: number;
  bins: ClusterBin[];
  collectible_bins_weight_kg: number;
}

// ── Scheduler response types ──────────────────────────────────────────────────

export interface RouteStop {
  sequence: number;
  cluster_id: string;
  cluster_name?: string;
  lat: number;
  lng: number;
  bins: string[];
  estimated_arrival: string;
}

export interface DispatchResult {
  success: boolean;
  vehicle_id?: string;
  driver_id?: string;
  route_plan_id?: string;
  route?: RouteStop[];
}

// ── Scheduler → Orchestrator completion callback ──────────────────────────────

export interface JobCompleteRequest {
  job_id: string;
  vehicle_id: string;
  driver_id: string;
  bins_collected: Array<{
    bin_id: string;
    collected_at: string;
    fill_level_at_collection: number;
    actual_weight_kg?: number;
    gps_lat: number;
    gps_lng: number;
  }>;
  bins_skipped: Array<{
    bin_id: string;
    skip_reason: string;
  }>;
  actual_weight_kg: number;
  actual_distance_km: number;
  route_gps_trail: Array<{ lat: number; lng: number; timestamp: string }>;
}
