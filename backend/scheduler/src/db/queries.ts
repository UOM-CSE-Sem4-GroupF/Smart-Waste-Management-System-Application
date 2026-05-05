import { Driver, Vehicle, RoutePlan, BinCollectionRecord, JobAssignment } from '../types';

const SEED_DRIVERS: [string, Driver][] = [
  ['DRV-001', { driver_id: 'DRV-001', name: 'Amal Perera',      zone_id: 'Zone-1', shift_start: '06:00', shift_end: '14:00', available: true }],
  ['DRV-002', { driver_id: 'DRV-002', name: 'Nimal Silva',       zone_id: 'Zone-2', shift_start: '06:00', shift_end: '14:00', available: true }],
  ['DRV-003', { driver_id: 'DRV-003', name: 'Kamal Fernando',    zone_id: 'Zone-3', shift_start: '14:00', shift_end: '22:00', available: true }],
  ['DRV-004', { driver_id: 'DRV-004', name: 'Sunil Jayawardena', zone_id: 'Zone-1', shift_start: '14:00', shift_end: '22:00', available: true }],
  ['DRV-005', { driver_id: 'DRV-005', name: 'Roshan Bandara',    zone_id: 'Zone-2', shift_start: '22:00', shift_end: '06:00', available: true }],
];

const SEED_VEHICLES: [string, Vehicle][] = [
  ['LORRY-01', { vehicle_id: 'LORRY-01', name: 'Lorry 01', max_cargo_kg: 5000, waste_categories: ['general', 'paper', 'plastic'],  available: true, lat: 6.9271, lng: 79.8612, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-02', { vehicle_id: 'LORRY-02', name: 'Lorry 02', max_cargo_kg: 8000, waste_categories: ['glass', 'e_waste'],              available: true, lat: 6.9355, lng: 79.8495, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-03', { vehicle_id: 'LORRY-03', name: 'Lorry 03', max_cargo_kg: 4000, waste_categories: ['food_waste', 'general'],         available: true, lat: 6.9215, lng: 79.8780, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-04', { vehicle_id: 'LORRY-04', name: 'Lorry 04', max_cargo_kg: 6000, waste_categories: ['general', 'food_waste', 'paper'], available: true, lat: 6.9190, lng: 79.8650, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
];

export const drivers  = new Map<string, Driver>(SEED_DRIVERS);
export const vehicles = new Map<string, Vehicle>(SEED_VEHICLES);

const routePlans     = new Map<string, RoutePlan>();
const binCollections = new Map<string, Map<string, BinCollectionRecord>>();
const jobAssignments = new Map<string, JobAssignment>();

let planCounter = 0;

export function clearAll(): void {
  drivers.clear();
  SEED_DRIVERS.forEach(([k, v]) => drivers.set(k, { ...v }));
  vehicles.clear();
  SEED_VEHICLES.forEach(([k, v]) => vehicles.set(k, { ...v, last_update: new Date().toISOString() }));
  routePlans.clear();
  binCollections.clear();
  jobAssignments.clear();
  planCounter = 0;
}

// ── Driver queries ───────────────────────────────────────────────────────────

export function findAvailableDriver(zone_id: string, exclude_ids: string[] = []): Driver | undefined {
  for (const d of drivers.values()) {
    if (d.available && d.zone_id === zone_id && !exclude_ids.includes(d.driver_id)) return d;
  }
  for (const d of drivers.values()) {
    if (d.available && !exclude_ids.includes(d.driver_id)) return d;
  }
  return undefined;
}

// ── Vehicle queries ──────────────────────────────────────────────────────────

export function findSmallestSufficientVehicle(waste_category: string, min_kg: number): Vehicle | undefined {
  const candidates = [...vehicles.values()]
    .filter(v => v.available && v.waste_categories.includes(waste_category) && v.max_cargo_kg >= min_kg)
    .sort((a, b) => a.max_cargo_kg - b.max_cargo_kg);
  return candidates[0];
}

export function findAvailableVehicle(waste_category: string, planned_weight_kg: number): Vehicle | undefined {
  return (
    findSmallestSufficientVehicle(waste_category, planned_weight_kg) ??
    [...vehicles.values()].find(v => v.available && v.waste_categories.includes(waste_category))
  );
}

// ── Job assignment ───────────────────────────────────────────────────────────

export function assignJob(job_id: string, driver_id: string, vehicle_id: string, planned_weight_kg: number): JobAssignment {
  const driver  = drivers.get(driver_id)!;
  const vehicle = vehicles.get(vehicle_id)!;
  driver.available       = false;
  driver.current_job_id  = job_id;
  vehicle.available      = false;
  vehicle.current_job_id = job_id;
  const assignment: JobAssignment = { job_id, driver_id, vehicle_id, assigned_at: new Date().toISOString(), planned_weight_kg };
  jobAssignments.set(job_id, assignment);
  return assignment;
}

export function releaseJob(job_id: string): void {
  const assignment = jobAssignments.get(job_id);
  if (!assignment) return;
  const driver  = drivers.get(assignment.driver_id);
  const vehicle = vehicles.get(assignment.vehicle_id);
  if (driver)  { driver.available  = true; delete driver.current_job_id; }
  if (vehicle) { vehicle.available = true; delete vehicle.current_job_id; }
}

export function getJobAssignment(job_id: string): JobAssignment | undefined {
  return jobAssignments.get(job_id);
}

// ── Route plan ───────────────────────────────────────────────────────────────

export function createRoutePlan(plan: Omit<RoutePlan, 'id' | 'created_at'>): RoutePlan {
  const id   = `RP-${String(++planCounter).padStart(4, '0')}`;
  const full: RoutePlan = { ...plan, id, created_at: new Date().toISOString() };
  routePlans.set(id, full);
  return full;
}

export function getRoutePlanByJob(job_id: string): RoutePlan | undefined {
  for (const p of routePlans.values()) {
    if (p.job_id === job_id) return p;
  }
  return undefined;
}

// ── Bin collection records ───────────────────────────────────────────────────

export function createBinCollectionRecords(
  job_id: string,
  records: Omit<BinCollectionRecord, 'job_id' | 'status'>[],
): void {
  if (!binCollections.has(job_id)) binCollections.set(job_id, new Map());
  const jobBins = binCollections.get(job_id)!;
  for (const r of records) {
    jobBins.set(r.bin_id, { ...r, job_id, status: 'pending' });
  }
}

export function getJobBins(job_id: string): BinCollectionRecord[] {
  return [...(binCollections.get(job_id)?.values() ?? [])];
}

export function getBinRecord(job_id: string, bin_id: string): BinCollectionRecord | undefined {
  return binCollections.get(job_id)?.get(bin_id);
}

export function updateBinCollected(
  job_id: string,
  bin_id: string,
  data: {
    fill_level_at_collection?: number;
    gps_lat?: number;
    gps_lng?: number;
    actual_weight_kg?: number;
    notes?: string;
    photo_url?: string;
  },
): BinCollectionRecord | undefined {
  const rec = binCollections.get(job_id)?.get(bin_id);
  if (!rec) return undefined;
  rec.status       = 'collected';
  rec.collected_at = new Date().toISOString();
  if (data.fill_level_at_collection != null) rec.fill_level_at_collection = data.fill_level_at_collection;
  if (data.gps_lat != null)        rec.gps_lat        = data.gps_lat;
  if (data.gps_lng != null)        rec.gps_lng        = data.gps_lng;
  if (data.actual_weight_kg != null) rec.actual_weight_kg = data.actual_weight_kg;
  if (data.notes)     rec.notes     = data.notes;
  if (data.photo_url) rec.photo_url = data.photo_url;
  return rec;
}

export function updateBinSkipped(
  job_id: string,
  bin_id: string,
  data: { skip_reason: string; skip_notes?: string },
): BinCollectionRecord | undefined {
  const rec = binCollections.get(job_id)?.get(bin_id);
  if (!rec) return undefined;
  rec.status      = 'skipped';
  rec.skipped_at  = new Date().toISOString();
  rec.skip_reason = data.skip_reason;
  if (data.skip_notes) rec.skip_notes = data.skip_notes;
  return rec;
}

export function markBinArrived(job_id: string, bin_id: string): void {
  const rec = binCollections.get(job_id)?.get(bin_id);
  if (rec && !rec.arrived_at) rec.arrived_at = new Date().toISOString();
}

// ── Cargo / progress helpers ─────────────────────────────────────────────────

export function getJobCargoKg(job_id: string): number {
  return getJobBins(job_id)
    .filter(b => b.status === 'collected')
    .reduce((sum, b) => sum + (b.actual_weight_kg ?? b.estimated_weight_kg), 0);
}

export interface JobProgressSummary {
  job_id:                string;
  driver_id:             string;
  vehicle_id:            string;
  assigned_at:           string;
  planned_weight_kg:     number;
  bins_collected:        number;
  bins_skipped:          number;
  bins_pending:          number;
  cargo_weight_kg:       number;
  cargo_limit_kg:        number;
  cargo_utilisation_pct: number;
  job_complete:          boolean;
  bin_statuses:          BinCollectionRecord[];
}

export function getJobProgressSummary(job_id: string): JobProgressSummary | undefined {
  const assignment = jobAssignments.get(job_id);
  if (!assignment) return undefined;
  const bins                = getJobBins(job_id);
  const vehicle             = vehicles.get(assignment.vehicle_id);
  const cargo_weight_kg     = getJobCargoKg(job_id);
  const cargo_limit_kg      = vehicle?.max_cargo_kg ?? 0;
  const bins_collected      = bins.filter(b => b.status === 'collected').length;
  const bins_skipped        = bins.filter(b => b.status === 'skipped').length;
  const bins_pending        = bins.filter(b => b.status === 'pending').length;
  const job_complete        = bins.length > 0 && bins_pending === 0;
  return {
    job_id,
    driver_id:             assignment.driver_id,
    vehicle_id:            assignment.vehicle_id,
    assigned_at:           assignment.assigned_at,
    planned_weight_kg:     assignment.planned_weight_kg,
    bins_collected,
    bins_skipped,
    bins_pending,
    cargo_weight_kg,
    cargo_limit_kg,
    cargo_utilisation_pct: cargo_limit_kg > 0
      ? Math.round((cargo_weight_kg / cargo_limit_kg) * 1000) / 10
      : 0,
    job_complete,
    bin_statuses: bins,
  };
}
