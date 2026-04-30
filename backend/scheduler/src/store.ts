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
export const routePlans = new Map<string, RoutePlan>();
export const binCollectionRecords = new Map<string, BinCollectionRecord>();

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
  clusters: Cluster[],
  bins: BinToCollect[],
  availableVehicles: Array<{ vehicle_id: string; max_cargo_kg: number; lat: number; lng: number }>,
  depot: { lat: number; lng: number },
  constraints: any
): Promise<{
  vehicle_id: string;
  waypoints: Waypoint[];
  total_distance_km: number;
  estimated_minutes: number;
}> {
  // Simple mock implementation - in real system this would call OR-Tools
  const vehicle = availableVehicles[0];
  const waypoints: Waypoint[] = bins.map((bin, index) => ({
    cluster_id: bin.cluster_id,
    bins: [bin.bin_id],
    estimated_arrival: null,
    cumulative_weight_kg: bin.estimated_weight_kg * (index + 1)
  }));

  return {
    vehicle_id: vehicle.vehicle_id,
    waypoints,
    total_distance_km: 50,
    estimated_minutes: 120
  };
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
