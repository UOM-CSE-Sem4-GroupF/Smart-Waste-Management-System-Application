export type JobState =
  | 'CREATED' | 'BIN_CONFIRMING' | 'BIN_CONFIRMED'
  | 'CLUSTER_ASSEMBLING' | 'CLUSTER_ASSEMBLED'
  | 'DISPATCHING' | 'DISPATCHED' | 'DRIVER_NOTIFIED'
  | 'IN_PROGRESS' | 'SPLIT_JOB' | 'COMPLETING' | 'COLLECTION_DONE'
  | 'RECORDING_AUDIT' | 'AUDIT_RECORDED'
  | 'COMPLETED' | 'FAILED' | 'ESCALATED' | 'CANCELLED' | 'AUDIT_FAILED'

export type JobType = 'routine' | 'emergency'

// Shape returned by REST GET /api/v1/collection-jobs (list)
export interface CollectionJobListItem {
  job_id:               string
  job_type:             JobType
  zone_id:              string | number
  zone_name?:           string
  state:                JobState
  priority?:            number
  assigned_vehicle_id?: string | null
  assigned_driver_id?:  string | null
  clusters:             string[]
  bins_to_collect:      string[]
  planned_weight_kg?:   number | null
  actual_weight_kg?:    number | null
  actual_duration_min?: number | null
  bins_total?:          number
  bins_collected?:      number
  bins_skipped?:        number
  created_at:           string
  completed_at?:        string | null
  duration_minutes?:    number | null
  waste_category?:      string
  trigger_bin_id?:      string
  trigger_urgency_score?: number
  failure_reason?:      string
}

// Shape returned by REST GET /api/v1/collection-jobs/:id (detail — extends list item)
export interface CollectionJobDetail extends CollectionJobListItem {
  route_plan_id:         string | null
  planned_distance_km:   number | null
  actual_distance_km:    number | null
  planned_duration_min:  number | null
  hyperledger_tx_id:     string | null
  escalated_at:          string | null
  bin_collections: Array<{
    bin_id:                   string
    cluster_id:               string
    sequence_number:          number
    status:                   'collected' | 'skipped' | 'pending'
    collected_at:             string | null
    fill_level_at_collection: number | null
    estimated_weight_kg:      number
    actual_weight_kg:         number | null
    skip_reason:              string | null
  }>
  state_history: Array<{
    from_state:      string | null
    to_state:        string
    reason:          string | null
    actor:           string
    transitioned_at: string
  }>
  step_log: Array<{
    step_name:      string
    attempt_number: number
    success:        boolean
    duration_ms:    number
    executed_at:    string
  }>
}

// Shape of job events received via Socket.IO (job:created, job:completed, job:cancelled)
export interface CollectionJob {
  job_id:           string
  job_type:         JobType
  zone_id:          number
  zone_name:        string
  clusters:         string[]
  vehicle_id:       string
  driver_id:        string | null
  total_bins:       number
  planned_weight_kg: number
  priority:         number
  route: Array<{
    sequence:          number
    cluster_id:        string
    cluster_name:      string
    lat:               number
    lng:               number
    bins:              string[]
    estimated_arrival: string
  }>
  state?:              JobState
  bins_collected?:     number
  bins_skipped?:       number
  actual_weight_kg?:   number
  duration_minutes?:   number
}

export interface JobProgress {
  job_id:                  string
  state:                   JobState
  vehicle_id:              string
  driver_id:               string
  driver_name:             string
  total_bins:              number
  bins_collected:          number
  bins_skipped:            number
  bins_pending:            number
  cargo_weight_kg:         number
  cargo_limit_kg:          number
  cargo_utilisation_pct:   number
  estimated_completion_at: string | null
  current_stop: {
    cluster_id:             string
    cluster_name:           string
    bins_at_stop:           number
    bins_collected_at_stop: number
  } | null
  waypoints: Array<{
    sequence:     number
    cluster_id:   string
    cluster_name: string
    bins:         string[]
    status:       'completed' | 'current' | 'pending'
    arrived_at:   string | null
    completed_at: string | null
  }>
}
