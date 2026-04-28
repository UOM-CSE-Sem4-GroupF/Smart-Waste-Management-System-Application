import { RouteWaypoint, BinToCollect, ClusterRef, Vehicle } from '../types';

const ROUTE_OPTIMIZER_URL = process.env.ROUTE_OPTIMIZER_URL ?? 'http://localhost:3005';

export interface SolveRequest {
  clusters:           ClusterRef[];
  bins:               BinToCollect[];
  available_vehicles: Array<{ vehicle_id: string; max_cargo_kg: number; lat: number; lng: number }>;
  depot:              { lat: number; lng: number };
  constraints: {
    time_windows_per_bin:      Array<{ bin_id: string; urgency_score: number }>;
    max_cargo_kg_per_vehicle:  Array<{ vehicle_id: string; max_cargo_kg: number }>;
    waste_category_per_vehicle: Array<{ vehicle_id: string; categories: string[] }>;
  };
}

export interface SolveResponse {
  vehicle_id:          string;
  waypoints:           RouteWaypoint[];
  total_distance_km:   number;
  estimated_minutes:   number;
}

export async function solve(body: SolveRequest): Promise<SolveResponse> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 35_000);
  try {
    const res = await fetch(`${ROUTE_OPTIMIZER_URL}/internal/route-optimizer/solve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    if (!res.ok) throw new Error(`OR-Tools returned ${res.status}`);
    return await res.json() as SolveResponse;
  } finally {
    clearTimeout(timer);
  }
}
