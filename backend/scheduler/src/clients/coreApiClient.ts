import 'dotenv/config';

const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service.waste-dev.svc.cluster.local:8001';
const BASE = `${CORE_API}/api/v1`;

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler:coreApi', message: msg }) + '\n');

interface ApiVehicle {
  id: string;
  max_cargo_kg: number;
  status: string;
  waste_categories: Array<{ category: { id: number; name: string } }>;
}

export interface FoundVehicle {
  vehicle_id:   string;
  max_cargo_kg: number;
}

export async function findAvailableVehicle(
  waste_category: string,
  min_capacity_kg: number,
): Promise<FoundVehicle | null> {
  const res = await fetch(`${BASE}/vehicles?status=available`);
  if (!res.ok) {
    slog('WARN', `findAvailableVehicle: Core API responded ${res.status}`);
    return null;
  }
  const body = await res.json() as { data?: ApiVehicle[] };
  const candidates = (body.data ?? [])
    .filter(v =>
      v.max_cargo_kg >= min_capacity_kg &&
      v.waste_categories.some(wc => wc.category.name === waste_category),
    )
    .sort((a, b) => a.max_cargo_kg - b.max_cargo_kg);

  const v = candidates[0];
  if (!v) return null;
  return { vehicle_id: v.id, max_cargo_kg: v.max_cargo_kg };
}

export async function setVehicleStatus(
  vehicle_id: string,
  status: 'available' | 'dispatched' | 'maintenance',
): Promise<void> {
  const res = await fetch(`${BASE}/vehicles/${vehicle_id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });
  if (!res.ok) slog('WARN', `setVehicleStatus(${vehicle_id}, ${status}): Core API responded ${res.status}`);
}

export interface CreateRoutePlanParams {
  vehicle_id:            string;
  zone_id:               number;
  route_type:            'emergency' | 'routine';
  waypoints:             Array<{ cluster_id: string; bins: string[]; estimated_arrival?: string | null; cumulative_weight_kg?: number }>;
  total_clusters:        number;
  total_bins:            number;
  estimated_weight_kg:   number;
  estimated_distance_km?: number;
  estimated_minutes?:    number;
}

export async function createRoutePlan(params: CreateRoutePlanParams): Promise<string> {
  const res = await fetch(`${BASE}/route-plans`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicle_id:            params.vehicle_id,
      route_type:            params.route_type,
      zone_id:               params.zone_id,
      valid_for_date:        new Date().toISOString(),
      waypoints:             params.waypoints,
      total_clusters:        params.total_clusters,
      total_bins:            params.total_bins,
      estimated_weight_kg:   params.estimated_weight_kg,
      estimated_distance_km: params.estimated_distance_km ?? 0,
      polyline:              null,
      status:                'planned',
    }),
  });
  if (!res.ok) throw new Error(`createRoutePlan failed: Core API responded ${res.status}`);
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}
