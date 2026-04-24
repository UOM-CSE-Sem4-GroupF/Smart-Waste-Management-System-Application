export interface Driver {
  driver_id:       string;
  name:            string;
  zone_id:         string;
  shift_start:     string;
  shift_end:       string;
  available:       boolean;
  current_job_id?: string;
  lat?:            number;
  lng?:            number;
}

export interface Vehicle {
  vehicle_id:       string;
  name:             string;
  max_cargo_kg:     number;
  waste_categories: string[];
  available:        boolean;
  current_job_id?:  string;
  lat:              number;
  lng:              number;
  heading:          number;
  speed_kmh:        number;
  last_update:      string;
}

export interface BinProgressEntry {
  bin_id:           string;
  order:            number;
  status:           'pending' | 'collected' | 'skipped';
  collected_at?:    string;
  skipped_reason?:  string;
  actual_weight_kg?: number;
}

export interface JobProgress {
  job_id:           string;
  driver_id:        string;
  vehicle_id:       string;
  assigned_at:      string;
  planned_weight_kg: number;
  current_cargo_kg: number;
  bin_statuses:     BinProgressEntry[];
}

export interface AssignRequest {
  job_id:              string;
  zone_id:             string;
  waste_category:      string;
  planned_weight_kg:   number;
  exclude_driver_ids?: string[];
}
