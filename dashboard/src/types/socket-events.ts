/**
 * Consolidated Socket.IO event payload types.
 *
 * These re-export (or re-declare) all payload shapes so the SocketProvider
 * and store files can import from a single location.
 */

// ── bin:update ─────────────────────────────────────────────────────────────────
export type { BinUpdatePayload  as BinUpdateEvent  } from './bin'
export type { ZoneStatsPayload  as ZoneStatsEvent  } from './bin'

// ── vehicle:position ───────────────────────────────────────────────────────────
// heading_degrees is intentionally optional — VehicleMarker rotates the lorry
// icon by this value when present.
export type { VehiclePositionPayload as VehiclePositionEvent } from './vehicle'

// ── job events ─────────────────────────────────────────────────────────────────
import type { CollectionJob, JobProgress, JobState, JobType } from './job'

/** job:created — full job object emitted when a new job enters the system */
export type JobCreatedEvent = CollectionJob

/** job:progress — incremental update emitted while a job is in flight */
export type JobProgressEvent = JobProgress

/** job:completed — emitted when a job reaches COMPLETED state */
export interface JobCompletedEvent {
  job_id:           string
  vehicle_id:       string
  driver_id:        string | null
  zone_id:          number
  state:            JobState
  bins_collected:   number
  bins_skipped:     number
  actual_weight_kg: number | null
  duration_minutes: number | null
  completed_at:     string
}

/** job:cancelled — emitted when a job is cancelled or fails */
export interface JobCancelledEvent {
  job_id:           string
  vehicle_id:       string
  zone_id:          number
  state:            JobState
  reason:           string | null
  cancelled_at:     string
}

// ── alert events ───────────────────────────────────────────────────────────────

/** alert:urgent — bin fill level threshold crossed, no collection scheduled */
export interface AlertUrgentEvent {
  alert_id:   string
  bin_id:     string
  zone_id:    number
  message:    string
  issued_at:  string
}

/** alert:deviation — vehicle is off planned route */
export interface AlertDeviationEvent {
  alert_id:    string
  vehicle_id:  string
  job_id:      string
  zone_id:     number
  message:     string
  issued_at:   string
}

/** alert:escalated — emergency condition that needs supervisor action */
export interface AlertEscalatedEvent {
  alert_id:  string
  job_id?:   string
  zone_id:   number
  message:   string
  issued_at: string
}

// ── convenience union ──────────────────────────────────────────────────────────
export type SocketEventName =
  | 'bin:update'
  | 'vehicle:position'
  | 'job:created'
  | 'job:progress'
  | 'job:completed'
  | 'job:cancelled'
  | 'zone:stats'
  | 'alert:urgent'
  | 'alert:deviation'
  | 'alert:escalated'
