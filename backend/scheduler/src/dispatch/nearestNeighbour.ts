import { BinToCollect, RouteWaypoint } from '../types';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

export function nearestNeighbourFallback(
  bins:  BinToCollect[],
  depot: { lat: number; lng: number },
  job_id: string,
): RouteWaypoint[] {
  const remaining = [...bins];
  const route: RouteWaypoint[] = [];
  let current = depot;
  let cumulative = 0;

  while (remaining.length > 0) {
    let nearest  = remaining[0];
    let minDist  = haversineKm(current.lat, current.lng, nearest.lat, nearest.lng);

    for (const bin of remaining) {
      const d = haversineKm(current.lat, current.lng, bin.lat, bin.lng);
      if (d < minDist) { nearest = bin; minDist = d; }
    }

    cumulative += nearest.estimated_weight_kg;
    route.push({
      cluster_id:           nearest.cluster_id,
      bins:                 [nearest.bin_id],
      estimated_arrival:    null,
      cumulative_weight_kg: cumulative,
    });

    current = { lat: nearest.lat, lng: nearest.lng };
    remaining.splice(remaining.indexOf(nearest), 1);
  }

  process.stdout.write(
    JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', service: 'scheduler', message: `OR-Tools timed out, using nearest-neighbour fallback`, job_id }) + '\n',
  );

  return route;
}
