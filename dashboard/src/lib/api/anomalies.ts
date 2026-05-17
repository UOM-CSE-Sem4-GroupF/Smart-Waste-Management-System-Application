import type { KyInstance } from 'ky'

export type AnomalyType = 'offline' | 'critical_fill' | 'urgent_fill' | 'low_battery'

export interface AnomalyBin {
  bin_id:                string
  cluster_id:            string | null
  cluster_name:          string | null
  zone_id:               number
  waste_category:        string
  waste_category_colour: string
  anomaly_types:         AnomalyType[]
  status:                string
  fill_level_pct:        number
  battery_level_pct:     number | null
  urgency_score:         number
  last_reading_at:       string
}

export interface AnomalySummary {
  total:         number
  offline:       number
  critical_fill: number
  urgent_fill:   number
  low_battery:   number
}

export interface AnomalyResponse {
  summary: AnomalySummary
  bins:    AnomalyBin[]
}

export async function getAnomalies(api: KyInstance) {
  const res = await api.get('api/v1/bins/anomalies').json<{ data: AnomalyResponse }>()
  return res.data
}
