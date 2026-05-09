export type BinStatus = 'normal' | 'monitor' | 'urgent' | 'critical' | 'offline'
export type WasteCategory = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste'

// Shape returned by REST GET /api/v1/bins and GET /api/v1/bins/:bin_id
export interface Bin {
  bin_id:                 string
  cluster_id:             string
  cluster_name:           string
  zone_id:                number
  zone_name:              string
  lat:                    number
  lng:                    number
  address:                string
  fill_level_pct:         number
  status:                 BinStatus
  urgency_score:          number
  estimated_weight_kg:    number
  waste_category:         WasteCategory
  waste_category_colour:  string
  predicted_full_at:      string | null
  battery_level_pct:      number
  last_reading_at:        string
  last_collected_at:      string | null
  has_active_job:         boolean
  // Only present on GET /api/v1/bins/:bin_id (single bin detail, not list)
  recent_collections?: Array<{
    job_id:                   string
    collected_at:             string
    driver_id:                string
    fill_level_at_collection: number
    actual_weight_kg:         number | null
    job_type:                 'routine' | 'emergency'
  }>
}

// Shape of the bin:update Socket.IO event payload (different from REST Bin)
export interface BinUpdatePayload {
  bin_id:                 string
  cluster_id:             string
  cluster_name?:          string
  zone_id:                number
  fill_level_pct:         number
  status:                 BinStatus
  urgency_score:          number
  estimated_weight_kg:    number
  waste_category:         WasteCategory
  waste_category_colour?: string
  fill_rate_pct_per_hour?: number
  predicted_full_at:      string | null
  battery_level_pct:      number
  has_active_job?:        boolean
  collection_triggered?:  boolean
  last_collected_at?:     string | null
  // Kafka pipeline sends latitude/longitude; normalized to lat/lng in SocketProvider
  lat?:                   number
  lng?:                   number
  latitude?:              number
  longitude?:             number
}

// Shape returned by REST GET /api/v1/bins/:bin_id/history
export interface BinHistory {
  bin_id:   string
  from:     string
  to:       string
  interval: string
  series: Array<{
    timestamp:           string
    fill_level_pct:      number
    urgency_score:       number
    estimated_weight_kg: number
  }>
  collection_events: Array<{
    collected_at:             string
    fill_level_at_collection: number
  }>
}

// Shape returned by REST GET /api/v1/zones/:zone_id/summary
export interface ZoneSummary {
  zone_id:                   number
  zone_name:                 string
  total_bins:                number
  total_clusters:            number
  status_breakdown: {
    normal:   number
    monitor:  number
    urgent:   number
    critical: number
    offline:  number
  }
  category_breakdown: Record<string, {
    total_bins:      number
    avg_fill_pct:    number
    total_weight_kg: number
    urgent_count:    number
  }>
  total_estimated_weight_kg: number
  active_jobs_count:         number
  last_updated:              string
}

// Shape of the zone:stats Socket.IO event payload (different from REST ZoneSummary)
export interface ZoneStatsPayload {
  zone_id:                   number
  zone_name:                 string
  avg_fill_level_pct:        number
  urgent_bin_count:          number
  critical_bin_count:        number
  total_bins:                number
  total_estimated_weight_kg: number
  dominant_waste_category:   string
  category_breakdown:        Record<string, { count: number; avg_fill: number; total_kg: number }>
  active_jobs_count:         number
  unassigned_urgent_bins:    number
}
