export interface VehiclePositionPayload {
  vehicle_id:            string
  driver_id:             string
  lat:                   number
  lng:                   number
  speed_kmh:             number
  heading_degrees?:      number
  job_id:                string
  zone_id:               number
  current_cluster?:      string
  next_cluster?:         string
  bins_collected:        number
  bins_total:            number
  cargo_weight_kg:       number
  cargo_limit_kg:        number
  cargo_utilisation_pct: number
  arrived_at_cluster?:   string
  weight_limit_warning?: boolean
}

export interface ActiveVehicle {
  vehicle_id:            string
  vehicle_type:          string
  driver_id:             string
  driver_name:           string
  job_id:                string
  job_type:              string
  zone_id:               number
  state:                 string
  current_lat:           number | null
  current_lng:           number | null
  last_seen_at:          string | null
  cargo_weight_kg:       number
  cargo_limit_kg:        number
  cargo_utilisation_pct: number
  bins_collected:        number
  bins_total:            number
}

/** Vehicle asset — used for Operations CRUD forms */
export interface VehicleAsset {
  vehicle_id:   string
  vehicle_type: string
  capacity_kg:  number
  registration: string
  year:         number
  status:       'active' | 'inactive' | 'maintenance'
}

export interface Driver {
  driver_id:    string
  name:         string
  driver_name?: string  // alias kept for backward compat
  vehicle_id:   string
  vehicle_type: string
  zone_id:      number
  status:       'available' | 'on_job' | 'off_duty'
  // Extended fields for Operations CRUD
  email?:       string
  phone?:       string
  license_no?:  string
}

