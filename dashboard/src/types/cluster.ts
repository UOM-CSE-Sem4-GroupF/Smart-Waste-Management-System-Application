export interface Cluster {
  cluster_id:          string
  cluster_name:        string
  lat:                 number
  lng:                 number
  zone_id:             number
  bin_count:           number
  max_urgency_score?:  number
  cluster_status?:     'normal' | 'monitor' | 'urgent' | 'critical'
  total_bins?:         number
  urgent_bins?:        number
  total_weight_kg?:    number
}
