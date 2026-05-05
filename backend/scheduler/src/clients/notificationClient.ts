import { RouteWaypoint, ClusterRef } from '../types';

const NOTIFICATION_URL = process.env.NOTIFICATION_URL ?? 'http://localhost:3004';

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${NOTIFICATION_URL}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch {
    process.stdout.write(
      JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', service: 'scheduler', message: `Notification service unreachable: ${path}` }) + '\n',
    );
  }
}

export interface JobAssignedPayload {
  driver_id:             string;
  vehicle_id:            string;
  job_id:                string;
  job_type:              'emergency' | 'routine';
  clusters:              ClusterRef[];
  route:                 RouteWaypoint[];
  estimated_duration_min: number;
  total_bins:            number;
  planned_weight_kg:     number;
}

export function notifyJobAssigned(body: JobAssignedPayload): Promise<void> {
  return post('/internal/notify/job-assigned', body);
}

export interface VehiclePositionPayload {
  vehicle_id:              string;
  driver_id:               string;
  job_id:                  string;
  zone_id:                 number;
  lat:                     number;
  lng:                     number;
  speed_kmh:               number;
  cargo_weight_kg:         number;
  cargo_limit_kg:          number;
  cargo_utilisation_pct:   number;
  bins_collected:          number;
  bins_total:              number;
  arrived_at_cluster?:     string;
  weight_limit_warning?:   boolean;
}

export function notifyVehiclePosition(body: VehiclePositionPayload): Promise<void> {
  return post('/internal/notify/vehicle-position', body);
}

export interface AlertDeviationPayload {
  vehicle_id:       string;
  driver_id:        string;
  job_id:           string;
  zone_id:          number;
  deviation_metres: number;
  duration_seconds: number;
  message:          string;
}

export function notifyAlertDeviation(body: AlertDeviationPayload): Promise<void> {
  return post('/internal/notify/alert-deviation', body);
}
