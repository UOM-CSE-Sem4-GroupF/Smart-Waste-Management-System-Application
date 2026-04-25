import { Driver, Vehicle, JobProgress, BinProgressEntry } from './types';

const SEED_DRIVERS: [string, Driver][] = [
  ['DRV-001', { driver_id: 'DRV-001', name: 'Amal Perera',      zone_id: 'Zone-1', shift_start: '06:00', shift_end: '14:00', available: true }],
  ['DRV-002', { driver_id: 'DRV-002', name: 'Nimal Silva',       zone_id: 'Zone-2', shift_start: '06:00', shift_end: '14:00', available: true }],
  ['DRV-003', { driver_id: 'DRV-003', name: 'Kamal Fernando',    zone_id: 'Zone-3', shift_start: '14:00', shift_end: '22:00', available: true }],
  ['DRV-004', { driver_id: 'DRV-004', name: 'Sunil Jayawardena', zone_id: 'Zone-1', shift_start: '14:00', shift_end: '22:00', available: true }],
  ['DRV-005', { driver_id: 'DRV-005', name: 'Roshan Bandara',    zone_id: 'Zone-2', shift_start: '22:00', shift_end: '06:00', available: true }],
];

export const drivers = new Map<string, Driver>(SEED_DRIVERS);

export const vehicles = new Map<string, Vehicle>([
  ['LORRY-01', { vehicle_id: 'LORRY-01', name: 'Lorry 01', max_cargo_kg: 5000, waste_categories: ['general', 'paper', 'plastic'],  available: true, lat: 6.9271, lng: 79.8612, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-02', { vehicle_id: 'LORRY-02', name: 'Lorry 02', max_cargo_kg: 8000, waste_categories: ['glass', 'e_waste'],              available: true, lat: 6.9355, lng: 79.8495, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-03', { vehicle_id: 'LORRY-03', name: 'Lorry 03', max_cargo_kg: 4000, waste_categories: ['food_waste', 'general'],         available: true, lat: 6.9215, lng: 79.8780, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
  ['LORRY-04', { vehicle_id: 'LORRY-04', name: 'Lorry 04', max_cargo_kg: 6000, waste_categories: ['general', 'food_waste', 'paper'], available: true, lat: 6.9190, lng: 79.8650, heading: 0, speed_kmh: 0, last_update: new Date().toISOString() }],
]);

export const jobProgress = new Map<string, JobProgress>();

export function resetStore(): void {
  drivers.clear();
  SEED_DRIVERS.forEach(([k, v]) => drivers.set(k, { ...v }));
  vehicles.forEach(v => { v.available = true; delete v.current_job_id; });
  jobProgress.clear();
}

export function findAvailableDriver(zone_id: string, exclude_ids: string[] = []): Driver | undefined {
  // Prefer same-zone driver first
  for (const d of drivers.values()) {
    if (d.available && d.zone_id === zone_id && !exclude_ids.includes(d.driver_id)) return d;
  }
  // Fall back to any available driver
  for (const d of drivers.values()) {
    if (d.available && !exclude_ids.includes(d.driver_id)) return d;
  }
  return undefined;
}

export function findAvailableVehicle(waste_category: string, planned_weight_kg: number): Vehicle | undefined {
  for (const v of vehicles.values()) {
    if (v.available && v.waste_categories.includes(waste_category) && v.max_cargo_kg >= planned_weight_kg) return v;
  }
  // If no weight-compatible vehicle found, try any vehicle supporting the category
  for (const v of vehicles.values()) {
    if (v.available && v.waste_categories.includes(waste_category)) return v;
  }
  return undefined;
}

export function assignJob(job_id: string, driver_id: string, vehicle_id: string, planned_weight_kg: number): JobProgress {
  const driver  = drivers.get(driver_id)!;
  const vehicle = vehicles.get(vehicle_id)!;

  driver.available       = false;
  driver.current_job_id  = job_id;
  vehicle.available      = false;
  vehicle.current_job_id = job_id;

  const progress: JobProgress = {
    job_id,
    driver_id,
    vehicle_id,
    assigned_at:      new Date().toISOString(),
    planned_weight_kg,
    current_cargo_kg: 0,
    bin_statuses:     [],
  };
  jobProgress.set(job_id, progress);
  return progress;
}

export function releaseJob(job_id: string): void {
  const progress = jobProgress.get(job_id);
  if (!progress) return;
  const driver  = drivers.get(progress.driver_id);
  const vehicle = vehicles.get(progress.vehicle_id);
  if (driver)  { driver.available  = true; delete driver.current_job_id; }
  if (vehicle) { vehicle.available = true; delete vehicle.current_job_id; }
}

export function recordBinCollected(job_id: string, bin_id: string, actual_weight_kg?: number): boolean {
  const progress = jobProgress.get(job_id);
  if (!progress) return false;
  const entry = progress.bin_statuses.find(b => b.bin_id === bin_id);
  if (entry) {
    entry.status       = 'collected';
    entry.collected_at = new Date().toISOString();
    if (actual_weight_kg != null) { entry.actual_weight_kg = actual_weight_kg; progress.current_cargo_kg += actual_weight_kg; }
  } else {
    progress.bin_statuses.push({ bin_id, order: progress.bin_statuses.length + 1, status: 'collected', collected_at: new Date().toISOString(), actual_weight_kg });
    if (actual_weight_kg != null) progress.current_cargo_kg += actual_weight_kg;
  }
  return true;
}

export function recordBinSkipped(job_id: string, bin_id: string, reason: string): boolean {
  const progress = jobProgress.get(job_id);
  if (!progress) return false;
  const entry = progress.bin_statuses.find(b => b.bin_id === bin_id);
  if (entry) {
    entry.status         = 'skipped';
    entry.skipped_reason = reason;
  } else {
    progress.bin_statuses.push({ bin_id, order: progress.bin_statuses.length + 1, status: 'skipped', skipped_reason: reason });
  }
  return true;
}
