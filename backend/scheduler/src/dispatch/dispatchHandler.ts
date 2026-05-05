import { DispatchRequest, DispatchResult, RouteWaypoint } from '../types';
import {
  findSmallestSufficientVehicle,
  findAvailableDriver,
  assignJob,
  createRoutePlan,
  createBinCollectionRecords,
} from '../db/queries';
import { solve } from '../clients/routeOptimizerClient';
import { notifyJobAssigned } from '../clients/notificationClient';
import { nearestNeighbourFallback } from './nearestNeighbour';

export async function handleDispatch(req: DispatchRequest): Promise<DispatchResult> {
  const { job_id, clusters, bins_to_collect, total_estimated_weight_kg, waste_category, zone_id } = req;

  // Step 1 — smallest sufficient vehicle
  const vehicle = findSmallestSufficientVehicle(waste_category, total_estimated_weight_kg);
  if (!vehicle) return { success: false, reason: 'NO_VEHICLE_AVAILABLE' };

  // Step 2 — available driver (prefer same zone)
  const driver = findAvailableDriver(String(zone_id));
  if (!driver) return { success: false, reason: 'NO_DRIVER_AVAILABLE' };

  // Step 3 — route optimisation (OR-Tools with 35s timeout, fallback to nearest-neighbour)
  let waypoints: RouteWaypoint[];
  let estimated_distance_km = 0;
  let estimated_minutes     = 0;

  try {
    const result = await solve({
      clusters,
      bins:               bins_to_collect,
      available_vehicles: [{ vehicle_id: vehicle.vehicle_id, max_cargo_kg: vehicle.max_cargo_kg, lat: vehicle.lat, lng: vehicle.lng }],
      depot:              { lat: vehicle.lat, lng: vehicle.lng },
      constraints: {
        time_windows_per_bin:       bins_to_collect.map(b => ({ bin_id: b.bin_id, urgency_score: b.urgency_score })),
        max_cargo_kg_per_vehicle:   [{ vehicle_id: vehicle.vehicle_id, max_cargo_kg: vehicle.max_cargo_kg }],
        waste_category_per_vehicle: [{ vehicle_id: vehicle.vehicle_id, categories: vehicle.waste_categories }],
      },
    });
    waypoints             = result.waypoints;
    estimated_distance_km = result.total_distance_km;
    estimated_minutes     = result.estimated_minutes;
  } catch {
    waypoints = nearestNeighbourFallback(bins_to_collect, { lat: vehicle.lat, lng: vehicle.lng }, job_id);
  }

  // Step 4 — assign resources
  assignJob(job_id, driver.driver_id, vehicle.vehicle_id, total_estimated_weight_kg);

  // Step 5 — persist route plan + bin records
  const plan = createRoutePlan({
    job_id,
    vehicle_id:            vehicle.vehicle_id,
    driver_id:             driver.driver_id,
    route_type:            'emergency',
    zone_id,
    waypoints,
    total_bins:            bins_to_collect.length,
    estimated_weight_kg:   total_estimated_weight_kg,
    estimated_distance_km,
    estimated_minutes,
    clusters,
    bins_to_collect,
  });

  createBinCollectionRecords(
    job_id,
    bins_to_collect.map((b, i) => ({
      bin_id:              b.bin_id,
      cluster_id:          b.cluster_id,
      lat:                 b.lat,
      lng:                 b.lng,
      sequence_number:     i + 1,
      estimated_weight_kg: b.estimated_weight_kg,
      planned_arrival_at:  null,
    })),
  );

  // Step 6 — push notification to driver
  await notifyJobAssigned({
    driver_id:              driver.driver_id,
    vehicle_id:             vehicle.vehicle_id,
    job_id,
    job_type:               'emergency',
    clusters,
    route:                  waypoints,
    estimated_duration_min: plan.estimated_minutes,
    total_bins:             bins_to_collect.length,
    planned_weight_kg:      total_estimated_weight_kg,
  });

  return {
    success:           true,
    vehicle_id:        vehicle.vehicle_id,
    driver_id:         driver.driver_id,
    route_plan_id:     plan.id,
    estimated_minutes: plan.estimated_minutes,
    route:             waypoints,
  };
}
