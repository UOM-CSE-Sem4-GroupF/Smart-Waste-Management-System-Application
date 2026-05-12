export interface Cluster {
  cluster_id:         string
  cluster_name:       string
  lat:                number
  lng:                number
  zone_id:            number
  zone_name:          string
  bin_count:          number
  max_urgency_score:  number
  cluster_status:     'normal' | 'monitor' | 'urgent' | 'critical'
  total_weight_kg:    number
  urgent_bins:        number
}
