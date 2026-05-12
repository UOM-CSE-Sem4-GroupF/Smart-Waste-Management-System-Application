import {
  Vehicle,
  Driver,
  RoutePlan,
  BinCollectionRecord,
  VehicleType,
  Waypoint,
  Cluster,
  BinToCollect
} from './types';

const SEED_DRIVERS: [string, Driver][] = [
  ['DRV-001', {
    driver_id: 'DRV-001',
    name: 'Amal Perera',
    vehicle_id: 'LORRY-01',
    zone_id: 1,
    status: 'available'
  }],
  ['DRV-002', {
    driver_id: 'DRV-002',
    name: 'Nimal Silva',
    vehicle_id: 'LORRY-02',
    zone_id: 2,
    status: 'available'
  }],
  ['DRV-003', {
    driver_id: 'DRV-003',
    name: 'Kamal Fernando',
    vehicle_id: 'LORRY-03',
    zone_id: 3,
    status: 'available'
  }],
  ['DRV-004', {
    driver_id: 'DRV-004',
    name: 'Sunil Jayawardena',
    vehicle_id: 'LORRY-04',
    zone_id: 1,
    status: 'available'
  }],
  ['DRV-005', {
    driver_id: 'DRV-005',
    name: 'Roshan Bandara',
    vehicle_id: 'LORRY-05',
    zone_id: 2,
    status: 'available'
  }],
];

const SEED_VEHICLES: [string, Vehicle][] = [
  ['LORRY-01', {
    vehicle_id: 'LORRY-01',
    name: 'Small Lorry 01',
    max_cargo_kg: 2000,
    waste_categories_supported: ['general', 'paper', 'plastic'],
    status: 'available',
    driver_id: 'DRV-001',
    lat: 6.9271,
    lng: 79.8612,
    zone_id: 1
  }],
  ['LORRY-02', {
    vehicle_id: 'LORRY-02',
    name: 'Medium Lorry 02',
    max_cargo_kg: 8000,
    waste_categories_supported: ['glass', 'e_waste'],
    status: 'available',
    driver_id: 'DRV-002',
    lat: 6.9355,
    lng: 79.8495,
    zone_id: 2
  }],
  ['LORRY-03', {
    vehicle_id: 'LORRY-03',
    name: 'Small Lorry 03',
    max_cargo_kg: 2000,
    waste_categories_supported: ['food_waste', 'general'],
    status: 'available',
    driver_id: 'DRV-003',
    lat: 6.9215,
    lng: 79.8780,
    zone_id: 3
  }],
  ['LORRY-04', {
    vehicle_id: 'LORRY-04',
    name: 'Medium Lorry 04',
    max_cargo_kg: 8000,
    waste_categories_supported: ['general', 'food_waste', 'paper'],
    status: 'available',
    driver_id: 'DRV-004',
    lat: 6.9190,
    lng: 79.8650,
    zone_id: 1
  }],
  ['LORRY-05', {
    vehicle_id: 'LORRY-05',
    name: 'Large Lorry 05',
    max_cargo_kg: 15000,
    waste_categories_supported: ['general', 'glass', 'plastic', 'paper'],
    status: 'available',
    driver_id: 'DRV-005',
    lat: 6.9320,
    lng: 79.8700,
    zone_id: 2
  }],
];

export const drivers = new Map<string, Driver>(SEED_DRIVERS);
export const vehicles = new Map<string, Vehicle>(SEED_VEHICLES);

const slog = (level: string, msg: string, extra?: Record<string, unknown>) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'scheduler:store', message: msg, ...extra }) + '\n');

// Load vehicles from Core API at startup, replacing seed data with real IDs
export async function syncVehiclesFromCoreApi(): Promise<void> {
  const CORE_API = process.env.CORE_API_URL ?? 'http://core-api-base-service.waste-dev.svc.cluster.local:8001';
  const url = `${CORE_API}/api/v1/vehicles?limit=200`;

  slog('INFO', `syncVehiclesFromCoreApi: fetching vehicles from ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      slog('WARN', `syncVehiclesFromCoreApi: Core API responded ${res.status} — keeping seed data`, { status: res.status });
      return;
    }
    const body = await res.json() as { data?: Array<{
      id: string;
      max_cargo_kg: number;
      status: string;
      waste_categories: Array<{ category: { name: string } }>;
    }> };

    const apiVehicles = body.data ?? [];
    if (apiVehicles.length === 0) {
      slog('WARN', 'syncVehiclesFromCoreApi: Core API returned 0 vehicles — keeping seed data');
      return;
    }

    // Clear seed data and populate with real vehicles from Core API
    vehicles.clear();
    for (const v of apiVehicles) {
      vehicles.set(v.id, {
        vehicle_id:                 v.id,
        name:                       v.id,
        max_cargo_kg:               v.max_cargo_kg,
        waste_categories_supported: v.waste_categories.map(wc => wc.category.name),
        status:                     (v.status as any) ?? 'available',
        driver_id:                  '',  // resolved later from F3 DB on dispatch
        lat:                        6.777805,
        lng:                        79.883911,
        zone_id:                    1,
      });
    }

    slog('INFO', `syncVehiclesFromCoreApi: loaded ${vehicles.size} vehicles from Core API`, {
      vehicle_ids: Array.from(vehicles.keys()),
    });
  } catch (e) {
    slog('ERROR', `syncVehiclesFromCoreApi: exception — keeping seed data: ${(e as Error).message}`);
  }
}

// Populate activeJobs from orchestrator on startup so vehicle positions aren't dropped after a pod restart
export async function syncActiveJobsFromOrchestrator(): Promise<void> {
  const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://orchestrator-base-service.waste-dev.svc.cluster.local:3001';

  slog('INFO', `syncActiveJobsFromOrchestrator: fetching active jobs from ${ORCHESTRATOR_URL}`);
  try {
    let loaded = 0;
    for (const state of ['DISPATCHED', 'IN_PROGRESS']) {
      const url = `${ORCHESTRATOR_URL}/api/v1/collection-jobs?state=${state}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) {
        slog('WARN', `syncActiveJobsFromOrchestrator: orchestrator responded ${res.status} for state=${state}`, { status: res.status });
        continue;
      }
      const body = await res.json() as { data?: Array<{
        job_id:               string;
        state:                string;
        zone_id?:             string | number;
        waste_category?:      string;
        assigned_vehicle_id?: string;
        assigned_driver_id?:  string;
        bins_to_collect?:     string[];
        created_at?:          string;
      }> };

      for (const job of (body.data ?? [])) {
        if (!job.assigned_vehicle_id) continue;
        activeJobs.set(job.job_id, {
          job_id:              job.job_id,
          state:               job.state as any,
          assigned_vehicle_id: job.assigned_vehicle_id,
          assigned_driver_id:  job.assigned_driver_id ?? '',
          zone_id:             typeof job.zone_id === 'string' ? parseInt(job.zone_id, 10) : (job.zone_id ?? 0),
          waste_category:      job.waste_category ?? 'general',
          total_bins:          job.bins_to_collect?.length ?? 0,
          created_at:          job.created_at ?? new Date().toISOString(),
        });
        loaded++;
      }
    }

    slog('INFO', `syncActiveJobsFromOrchestrator: loaded ${loaded} active jobs into store`, {
      job_ids: Array.from(activeJobs.keys()),
    });
  } catch (e) {
    slog('ERROR', `syncActiveJobsFromOrchestrator: exception — activeJobs remains empty: ${(e as Error).message}`);
  }
}
export const routePlans = new Map<string, RoutePlan>();
export const binCollectionRecords = new Map<string, BinCollectionRecord>();
export const clusterCoordinates = new Map<string, { lat: number; lng: number }>();

// In-memory job state (normally would be in database)
export const activeJobs = new Map<string, {
  job_id: string;
  state: 'CREATED' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  assigned_vehicle_id: string;
  assigned_driver_id: string;
  zone_id: number;
  waste_category: string;
  total_bins: number;
  created_at: string;
}>();

export function resetStore(): void {
  drivers.clear();
  SEED_DRIVERS.forEach(([k, v]) => drivers.set(k, { ...v }));
  vehicles.clear();
  SEED_VEHICLES.forEach(([k, v]) => vehicles.set(k, { ...v }));
  routePlans.clear();
  binCollectionRecords.clear();
  activeJobs.clear();
  clusterCoordinates.clear();
}

export function findAvailableVehicle(
  waste_category: string,
  total_estimated_weight_kg: number
): Vehicle | undefined {
  const candidates = Array.from(vehicles.values())
    .filter(v =>
      v.status === 'available' &&
      v.waste_categories_supported.includes(waste_category) &&
      v.max_cargo_kg >= total_estimated_weight_kg
    )
    .sort((a, b) => a.max_cargo_kg - b.max_cargo_kg); // Smallest first

  return candidates[0];
}

export function getVehicleType(max_cargo_kg: number): VehicleType {
  if (max_cargo_kg <= 2000) return VehicleType.SMALL;
  if (max_cargo_kg <= 8000) return VehicleType.MEDIUM;
  if (max_cargo_kg <= 15000) return VehicleType.LARGE;
  return VehicleType.EXTRA_LARGE;
}

// Mock OR-Tools call (in real implementation, this would call the route-optimizer service)
export async function callORTools(
  job_id: string,
  job_type: string,
  clusters: Cluster[],
  bins: BinToCollect[],
  availableVehicles: Array<{ vehicle_id: string; max_cargo_kg: number; waste_categories_supported: string[]; lat: number; lng: number }>,
  depot: { lat: number; lng: number },
  constraints: any
): Promise<{
  vehicle_id: string;
  waypoints: Waypoint[];
  total_distance_km: number;
  estimated_minutes: number;
  polyline?: string;
}> {
  const ROUTE_OPTIMIZER_URL = process.env.ROUTE_OPTIMIZER_URL || 'http://route-optimizer-base-service.waste-dev.svc.cluster.local:8083';

  const payload = {
    job_id,
    job_type,
    clusters: clusters.map(c => ({
      cluster_id: c.cluster_id,
      lat: c.lat,
      lng: c.lng,
      cluster_name: c.cluster_name
    })),
    bins: bins.map(b => ({
      bin_id: b.bin_id,
      cluster_id: b.cluster_id,
      lat: b.lat,
      lng: b.lng,
      waste_category: b.waste_category,
      fill_level_pct: b.fill_level_pct,
      estimated_weight_kg: b.estimated_weight_kg,
      urgency_score: b.urgency_score || 0,
      predicted_full_at: b.predicted_full_at
    })),
    available_vehicles: availableVehicles.map(v => ({
      vehicle_id: v.vehicle_id,
      max_cargo_kg: v.max_cargo_kg,
      waste_categories_supported: v.waste_categories_supported,
      current_lat: v.lat,
      current_lng: v.lng
    })),
    depot: {
      lat: depot.lat,
      lng: depot.lng
    },
    time_limit_seconds: constraints?.time_limit_seconds || 30
  };

  try {
    const response = await fetch(`${ROUTE_OPTIMIZER_URL}/internal/route-optimizer/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown Error', detail: response.statusText })) as any;
      throw new Error(`Optimizer failed [${response.status}]: ${errorData.error} - ${errorData.detail}`);
    }

    const data = await response.json() as any;

    return {
      vehicle_id: data.vehicle_id,
      total_distance_km: data.total_distance_km,
      estimated_minutes: data.estimated_minutes,
      polyline: data.polyline,
      waypoints: data.waypoints.map((wp: any) => ({
        cluster_id: wp.cluster_id,
        bins: wp.bins,
        estimated_arrival: wp.estimated_arrival_iso,
        cumulative_weight_kg: wp.cumulative_weight_kg
      }))
    };

  } catch (error) {
    console.warn(`[RouteOptimizer] Failed to get optimal route: ${(error as Error).message}. Falling back to Nearest Neighbour.`);
    
    const fallbackVehicle = availableVehicles[0];
    const fallbackRoute = nearestNeighbourFallback(bins, depot);
    
    return {
      vehicle_id: fallbackVehicle.vehicle_id,
      waypoints: fallbackRoute,
      total_distance_km: 0,
      estimated_minutes: 0
    };
  }
}

// Fallback nearest neighbour algorithm
export function nearestNeighbourFallback(
  bins: BinToCollect[],
  depot: { lat: number; lng: number }
): Waypoint[] {
  const remaining = [...bins];
  const route: Waypoint[] = [];
  let current = depot;
  let cumulativeWeight = 0;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDist = haversineKm(current.lat, current.lng, remaining[0].lat, remaining[0].lng);

    for (let i = 1; i < remaining.length; i++) {
      const dist = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }

    const nearest = remaining[nearestIndex];
    cumulativeWeight += nearest.estimated_weight_kg;

    route.push({
      cluster_id: nearest.cluster_id,
      bins: [nearest.bin_id],
      estimated_arrival: null,
      cumulative_weight_kg: cumulativeWeight
    });

    current = { lat: nearest.lat, lng: nearest.lng };
    remaining.splice(nearestIndex, 1);
  }

  return route;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
