export type SocketRoom = 'dashboard-all' | 'fleet-ops' | string;

export interface JobAssignedBody {
  job_id:          string;
  driver_id:       string;
  vehicle_id:      string;
  zone_id:         string;
  waste_category:  string;
  estimated_bins:  number;
  route_id?:       string;
}

export interface JobCancelledBody {
  job_id:     string;
  reason:     string;
  driver_id?: string;
}

export interface RouteUpdatedBody {
  job_id:    string;
  driver_id: string;
  route_id:  string;
}

export interface JobEscalatedBody {
  job_id:   string;
  zone_id:  string;
  reason:   string;
}
