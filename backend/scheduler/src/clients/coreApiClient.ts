import 'dotenv/config';

const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service.waste-dev.svc.cluster.local:8001';
const BASE = `${CORE_API}/api/v1`;

const slog = (level: string, msg: string, extra?: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler:coreApi', message: msg, ...extra }) + '\n');

async function timedFetch(label: string, url: string, init?: RequestInit): Promise<Response> {
  const t0 = Date.now();
  const method = init?.method ?? 'GET';
  slog('DEBUG', `→ ${method} ${url}`, { label });
  try {
    const res = await fetch(url, init);
    slog('DEBUG', `← ${method} ${url} ${res.status} (${Date.now() - t0}ms)`, { label, status: res.status });
    return res;
  } catch (e) {
    slog('ERROR', `✗ ${method} ${url} FAILED (${Date.now() - t0}ms): ${(e as Error).message}`, { label });
    throw e;
  }
}

interface ApiVehicle {
  id: string;
  max_cargo_kg: number;
  status: string;
  waste_categories: Array<{ category: { id: number; name: string } }>;
}

export interface FoundVehicle {
  vehicle_id:                  string;
  max_cargo_kg:                number;
  waste_categories_supported:  string[];
}

export async function findAvailableVehicle(
  waste_category: string,
  min_capacity_kg: number,
): Promise<FoundVehicle | null> {
  const url = `${BASE}/vehicles?status=available`;
  slog('DEBUG', `findAvailableVehicle: searching for ${waste_category} vehicle with min ${min_capacity_kg}kg capacity`, {
    waste_category, min_capacity_kg, url,
  });

  const res = await timedFetch('findAvailableVehicle', url);

  if (!res.ok) {
    slog('WARN', `findAvailableVehicle: Core API responded ${res.status}`, { status: res.status });
    return null;
  }

  const body = await res.json() as { data?: ApiVehicle[] };
  const all = body.data ?? [];
  slog('DEBUG', `findAvailableVehicle: Core API returned ${all.length} available vehicles`, {
    total_available: all.length,
    vehicle_ids: all.map(v => v.id),
  });

  const candidates = all
    .filter(v =>
      v.max_cargo_kg >= min_capacity_kg &&
      v.waste_categories.some(wc => wc.category.name === waste_category),
    )
    .sort((a, b) => a.max_cargo_kg - b.max_cargo_kg);

  const v = candidates[0];
  if (!v) {
    slog('WARN', `findAvailableVehicle: no eligible vehicle found`, {
      waste_category, min_capacity_kg, checked: all.length,
    });
    return null;
  }

  slog('INFO', `findAvailableVehicle: selected vehicle ${v.id} (${v.max_cargo_kg}kg capacity)`, {
    vehicle_id: v.id, max_cargo_kg: v.max_cargo_kg,
  });
  return {
    vehicle_id:                 v.id,
    max_cargo_kg:               v.max_cargo_kg,
    waste_categories_supported: v.waste_categories.map(wc => wc.category.name),
  };
}

export async function setVehicleStatus(
  vehicle_id: string,
  status: 'available' | 'dispatched' | 'maintenance',
): Promise<void> {
  slog('DEBUG', `setVehicleStatus: setting ${vehicle_id} → ${status}`, { vehicle_id, status });

  const res = await timedFetch(`setVehicleStatus-${status}`, `${BASE}/vehicles/${vehicle_id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });

  if (res.ok) {
    slog('DEBUG', `setVehicleStatus: ${vehicle_id} status updated to ${status}`, { vehicle_id, status });
  } else {
    slog('WARN', `setVehicleStatus(${vehicle_id}, ${status}): Core API responded ${res.status}`, {
      vehicle_id, status, http_status: res.status,
    });
  }
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

export async function fetchAllVehicles(): Promise<Array<{
  vehicle_id:                  string;
  max_cargo_kg:                number;
  status:                      string;
  waste_categories_supported:  string[];
}>> {
  const url = `${BASE}/vehicles?limit=200`;
  slog('DEBUG', `fetchAllVehicles: loading vehicles from Core API`, { url });

  try {
    const res = await timedFetch('fetchAllVehicles', url);
    if (!res.ok) {
      slog('WARN', `fetchAllVehicles: Core API responded ${res.status}`, { status: res.status });
      return [];
    }
    const body = await res.json() as { data?: ApiVehicle[] };
    const all = body.data ?? [];
    const mapped = all.map(v => ({
      vehicle_id:                 v.id,
      max_cargo_kg:               v.max_cargo_kg,
      status:                     v.status,
      waste_categories_supported: v.waste_categories.map(wc => wc.category.name),
    }));
    slog('INFO', `fetchAllVehicles: loaded ${mapped.length} vehicles`, {
      vehicle_ids: mapped.map(v => v.vehicle_id),
    });
    return mapped;
  } catch (e) {
    slog('ERROR', `fetchAllVehicles: exception: ${(e as Error).message}`);
    return [];
  }
}

export async function createRoutePlan(params: CreateRoutePlanParams): Promise<string> {
  slog('DEBUG', `createRoutePlan: creating ${params.route_type} route plan for vehicle ${params.vehicle_id}`, {
    vehicle_id:            params.vehicle_id,
    zone_id:               params.zone_id,
    route_type:            params.route_type,
    total_clusters:        params.total_clusters,
    total_bins:            params.total_bins,
    estimated_weight_kg:   params.estimated_weight_kg,
    estimated_distance_km: params.estimated_distance_km,
    estimated_minutes:     params.estimated_minutes,
    waypoint_count:        params.waypoints.length,
  });

  const res = await timedFetch('createRoutePlan', `${BASE}/route-plans`, {
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

  if (!res.ok) {
    slog('ERROR', `createRoutePlan: Core API responded ${res.status}`, {
      vehicle_id: params.vehicle_id,
      http_status: res.status,
    });
    throw new Error(`createRoutePlan failed: Core API responded ${res.status}`);
  }

  const body = await res.json() as { data: { id: string } };
  const route_plan_id = body.data.id;

  slog('INFO', `createRoutePlan: route plan created with id ${route_plan_id}`, {
    route_plan_id,
    vehicle_id: params.vehicle_id,
    zone_id:    params.zone_id,
  });

  return route_plan_id;
}
