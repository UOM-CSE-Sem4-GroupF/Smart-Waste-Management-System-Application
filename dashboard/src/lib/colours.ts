import type { BinStatus } from '@/types/bin'

/** Maps BinStatus → hex colour (mirrors globals.css --color-bin-* vars) */
export const STATUS_COLORS: Record<BinStatus, string> = {
  normal:   '#22c55e',
  monitor:  '#eab308',
  urgent:   '#f97316',
  critical: '#ef4444',
  offline:  '#6b7280',
}

/** Palette for per-zone colouring in charts and overlays (cycles when > 7 zones) */
export const ZONE_COLOURS = [
  '#3B82F6', '#8B5CF6', '#F97316', '#10B981',
  '#EF4444', '#EAB308', '#06B6D4',
]

/**
 * Maps uppercase JobState values → hex colour.
 * Use this for dynamic inline styles / canvas drawing.
 * Do NOT use the lowercase Tailwind keys (job.in_progress) for dynamic colouring.
 */
export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:             '#6B7280',
  DISPATCHING:         '#3B82F6',
  DISPATCHED:          '#3B82F6',
  IN_PROGRESS:         '#22C55E',
  COMPLETING:          '#22C55E',
  COLLECTION_DONE:     '#10B981',
  COMPLETED:           '#6B7280',
  ESCALATED:           '#EF4444',
  FAILED:              '#EF4444',
  CANCELLED:           '#6B7280',
  BIN_CONFIRMING:      '#8B5CF6',
  CLUSTER_ASSEMBLING:  '#8B5CF6',
  DRIVER_NOTIFIED:     '#EAB308',
}

/** Cycle through route colours by index */
export const ROUTE_COLOURS = ['#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EF4444', '#EAB308']
