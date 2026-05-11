// Canonical types for all Socket.IO event payloads
// Imported by SocketProvider and stores

export type { BinUpdatePayload as BinUpdateEvent }      from './bin'
export type { VehiclePositionPayload as VehiclePositionEvent } from './vehicle'

export interface ZoneStatsEvent {
  zone_id:            number
  zone_name:          string
  total_bins:         number
  urgent_bins:        number
  critical_bins:      number
  avg_fill_level_pct: number
  category_breakdown: Record<string, { count: number; total_kg: number }>
}

export interface JobCreatedEvent {
  job_id:             string
  job_type:           string
  zone_id:            number
  zone_name:          string
  state:              string
  assigned_vehicle_id: string | null
  assigned_driver_id: string | null
  total_bins:         number
  priority:           number
  route?: {
    waypoints: Array<{ lat: number; lng: number; cluster_id: string; bin_ids: string[] }>
  }
  created_at: string
}

export interface JobProgressEvent {
  job_id:           string
  bins_collected:   number
  bins_total:       number
  cargo_weight_kg:  number
  state:            string
}

export interface JobCompletedEvent {
  job_id:            string
  zone_id:           number
  vehicle_id:        string
  driver_id:         string
  bins_collected:    number
  bins_skipped:      number
  actual_weight_kg:  number        // NOT total_weight_kg
  duration_minutes:  number
  hyperledger_tx_id: string | null // NOT blockchain_tx_id
  timestamp:         string        // ISO 8601 — NOT completed_at
}

export interface JobCancelledEvent {
  job_id:       string
  reason?:      string
  cancelled_at: string
}

export interface AlertUrgentEvent {
  bin_id:        string
  zone_id:       number
  message:       string
  urgency_score: number
}

export interface AlertDeviationEvent {
  vehicle_id:       string
  job_id:           string
  zone_id:          number
  message:          string
  deviation_metres: number
}

export interface AlertEscalatedEvent {
  job_id:   string
  zone_id:  number
  message:  string
  reason:   string
}
