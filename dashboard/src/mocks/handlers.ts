import { http, HttpResponse } from 'msw'
import type { Bin, ZoneSummary, BinHistory, ZoneStatsPayload } from '@/types'
import type { ActiveVehicle, VehiclePositionPayload } from '@/types'
import type { CollectionJobListItem } from '@/types'

// ---------------------------------------------------------------------------
// Static mock data — exported so MockSocketInjector can use the same records
// ---------------------------------------------------------------------------

const NOW = Date.now()

export const MOCK_BINS: Bin[] = [
  // ── Zone 1 · Katubedda ─────────────────────────────────────────────────
  { bin_id: 'BIN-001', cluster_id: 'CLU-A', cluster_name: 'Katubedda North',   zone_id: 1, zone_name: 'Katubedda',       lat: 6.8002, lng: 79.8828, address: '12 Marine Drive',          fill_level_pct: 82, status: 'urgent',   urgency_score: 0.82, estimated_weight_kg: 41.0, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 3 * 3600_000).toISOString(),  battery_level_pct: 88, last_reading_at: new Date(NOW - 900_000).toISOString(),   last_collected_at: new Date(NOW - 26 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-002', cluster_id: 'CLU-A', cluster_name: 'Katubedda North',   zone_id: 1, zone_name: 'Katubedda',       lat: 6.7998, lng: 79.8835, address: '34 Station Road',          fill_level_pct: 45, status: 'normal',   urgency_score: 0.45, estimated_weight_kg: 22.5, waste_category: 'paper',      waste_category_colour: '#3b82f6', predicted_full_at: null,                                         battery_level_pct: 91, last_reading_at: new Date(NOW - 600_000).toISOString(),   last_collected_at: new Date(NOW - 48 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-003', cluster_id: 'CLU-B', cluster_name: 'Katubedda Central', zone_id: 1, zone_name: 'Katubedda',       lat: 6.7975, lng: 79.8842, address: '7 Old Galle Road',         fill_level_pct: 95, status: 'critical', urgency_score: 0.95, estimated_weight_kg: 47.5, waste_category: 'general',    waste_category_colour: '#6b7280', predicted_full_at: new Date(NOW + 1 * 3600_000).toISOString(),  battery_level_pct: 62, last_reading_at: new Date(NOW - 300_000).toISOString(),   last_collected_at: new Date(NOW - 72 * 3600_000).toISOString(), has_active_job: true  },
  { bin_id: 'BIN-004', cluster_id: 'CLU-B', cluster_name: 'Katubedda Central', zone_id: 1, zone_name: 'Katubedda',       lat: 6.7968, lng: 79.8849, address: '23 Siridhamma Road',       fill_level_pct: 58, status: 'monitor',  urgency_score: 0.58, estimated_weight_kg: 29.0, waste_category: 'plastic',    waste_category_colour: '#8b5cf6', predicted_full_at: new Date(NOW + 12 * 3600_000).toISOString(), battery_level_pct: 79, last_reading_at: new Date(NOW - 1200_000).toISOString(),  last_collected_at: new Date(NOW - 36 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-005', cluster_id: 'CLU-B', cluster_name: 'Katubedda Central', zone_id: 1, zone_name: 'Katubedda',       lat: 6.7961, lng: 79.8856, address: '5 Temple Lane',            fill_level_pct: 22, status: 'normal',   urgency_score: 0.22, estimated_weight_kg: 11.0, waste_category: 'glass',      waste_category_colour: '#06b6d4', predicted_full_at: null,                                         battery_level_pct: 95, last_reading_at: new Date(NOW - 1800_000).toISOString(),  last_collected_at: new Date(NOW - 24 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-006', cluster_id: 'CLU-C', cluster_name: 'Katubedda South',   zone_id: 1, zone_name: 'Katubedda',       lat: 6.7955, lng: 79.8862, address: '88 Railway Avenue',        fill_level_pct: 0,  status: 'offline',  urgency_score: 0.00, estimated_weight_kg: 0.0,  waste_category: 'general',    waste_category_colour: '#6b7280', predicted_full_at: null,                                         battery_level_pct: 8,  last_reading_at: new Date(NOW - 8 * 3600_000).toISOString(),  last_collected_at: new Date(NOW - 12 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-007', cluster_id: 'CLU-C', cluster_name: 'Katubedda South',   zone_id: 1, zone_name: 'Katubedda',       lat: 6.7948, lng: 79.8870, address: '15 Harbour Road',          fill_level_pct: 71, status: 'urgent',   urgency_score: 0.71, estimated_weight_kg: 35.5, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 6 * 3600_000).toISOString(),  battery_level_pct: 74, last_reading_at: new Date(NOW - 450_000).toISOString(),   last_collected_at: new Date(NOW - 30 * 3600_000).toISOString(), has_active_job: false },

  // ── Zone 2 · Moratuwa South ────────────────────────────────────────────
  { bin_id: 'BIN-008', cluster_id: 'CLU-D', cluster_name: 'Rawathawatta East', zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7935, lng: 79.8878, address: '3 Peeliyagoda Lane',      fill_level_pct: 34, status: 'normal',   urgency_score: 0.34, estimated_weight_kg: 17.0, waste_category: 'paper',      waste_category_colour: '#3b82f6', predicted_full_at: null,                                         battery_level_pct: 83, last_reading_at: new Date(NOW - 720_000).toISOString(),   last_collected_at: new Date(NOW - 20 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-009', cluster_id: 'CLU-D', cluster_name: 'Rawathawatta East', zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7929, lng: 79.8885, address: '67 Galle Road',           fill_level_pct: 88, status: 'critical', urgency_score: 0.88, estimated_weight_kg: 44.0, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 2 * 3600_000).toISOString(),  battery_level_pct: 71, last_reading_at: new Date(NOW - 300_000).toISOString(),   last_collected_at: new Date(NOW - 60 * 3600_000).toISOString(), has_active_job: true  },
  { bin_id: 'BIN-010', cluster_id: 'CLU-E', cluster_name: 'Rawathawatta West', zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7922, lng: 79.8892, address: '22 New Road',             fill_level_pct: 51, status: 'monitor',  urgency_score: 0.51, estimated_weight_kg: 25.5, waste_category: 'plastic',    waste_category_colour: '#8b5cf6', predicted_full_at: new Date(NOW + 10 * 3600_000).toISOString(), battery_level_pct: 86, last_reading_at: new Date(NOW - 900_000).toISOString(),   last_collected_at: new Date(NOW - 40 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-011', cluster_id: 'CLU-E', cluster_name: 'Rawathawatta West', zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7916, lng: 79.8899, address: '9 Fisheries Road',        fill_level_pct: 18, status: 'normal',   urgency_score: 0.18, estimated_weight_kg: 9.0,  waste_category: 'glass',      waste_category_colour: '#06b6d4', predicted_full_at: null,                                         battery_level_pct: 93, last_reading_at: new Date(NOW - 1500_000).toISOString(),  last_collected_at: new Date(NOW - 18 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-012', cluster_id: 'CLU-E', cluster_name: 'Rawathawatta West', zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7910, lng: 79.8906, address: '44 Beach Road',           fill_level_pct: 63, status: 'monitor',  urgency_score: 0.63, estimated_weight_kg: 31.5, waste_category: 'general',    waste_category_colour: '#6b7280', predicted_full_at: new Date(NOW + 9 * 3600_000).toISOString(),  battery_level_pct: 69, last_reading_at: new Date(NOW - 600_000).toISOString(),   last_collected_at: new Date(NOW - 44 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-013', cluster_id: 'CLU-F', cluster_name: 'Lunawa North',      zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7904, lng: 79.8913, address: '101 Borupana Road',       fill_level_pct: 91, status: 'critical', urgency_score: 0.91, estimated_weight_kg: 45.5, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 1 * 3600_000).toISOString(),  battery_level_pct: 55, last_reading_at: new Date(NOW - 180_000).toISOString(),   last_collected_at: new Date(NOW - 78 * 3600_000).toISOString(), has_active_job: true  },
  { bin_id: 'BIN-014', cluster_id: 'CLU-F', cluster_name: 'Lunawa North',      zone_id: 2, zone_name: 'Moratuwa South', lat: 6.7898, lng: 79.8920, address: '56 Lake View Road',       fill_level_pct: 40, status: 'normal',   urgency_score: 0.40, estimated_weight_kg: 20.0, waste_category: 'paper',      waste_category_colour: '#3b82f6', predicted_full_at: null,                                         battery_level_pct: 88, last_reading_at: new Date(NOW - 2400_000).toISOString(),  last_collected_at: new Date(NOW - 22 * 3600_000).toISOString(), has_active_job: false },

  // ── Zone 3 · Uyanwatta ─────────────────────────────────────────────────
  { bin_id: 'BIN-015', cluster_id: 'CLU-G', cluster_name: 'Uyanwatta Centre',  zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.8015, lng: 79.8921, address: '2 University Road',       fill_level_pct: 76, status: 'urgent',   urgency_score: 0.76, estimated_weight_kg: 38.0, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 5 * 3600_000).toISOString(),  battery_level_pct: 77, last_reading_at: new Date(NOW - 300_000).toISOString(),   last_collected_at: new Date(NOW - 28 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-016', cluster_id: 'CLU-G', cluster_name: 'Uyanwatta Centre',  zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.8009, lng: 79.8928, address: '19 Angulana Road',        fill_level_pct: 29, status: 'normal',   urgency_score: 0.29, estimated_weight_kg: 14.5, waste_category: 'plastic',    waste_category_colour: '#8b5cf6', predicted_full_at: null,                                         battery_level_pct: 90, last_reading_at: new Date(NOW - 1200_000).toISOString(),  last_collected_at: new Date(NOW - 16 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-017', cluster_id: 'CLU-H', cluster_name: 'Uyanwatta East',    zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.8003, lng: 79.8936, address: '77 Depot Road',           fill_level_pct: 55, status: 'monitor',  urgency_score: 0.55, estimated_weight_kg: 27.5, waste_category: 'e_waste',    waste_category_colour: '#10b981', predicted_full_at: new Date(NOW + 11 * 3600_000).toISOString(), battery_level_pct: 81, last_reading_at: new Date(NOW - 900_000).toISOString(),   last_collected_at: new Date(NOW - 50 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-018', cluster_id: 'CLU-H', cluster_name: 'Uyanwatta East',    zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.7997, lng: 79.8943, address: '33 Kirimandala Road',     fill_level_pct: 85, status: 'urgent',   urgency_score: 0.85, estimated_weight_kg: 42.5, waste_category: 'general',    waste_category_colour: '#6b7280', predicted_full_at: new Date(NOW + 4 * 3600_000).toISOString(),  battery_level_pct: 66, last_reading_at: new Date(NOW - 600_000).toISOString(),   last_collected_at: new Date(NOW - 34 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-019', cluster_id: 'CLU-I', cluster_name: 'Uyanwatta West',    zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.7990, lng: 79.8950, address: '14 Wekande Road',         fill_level_pct: 12, status: 'normal',   urgency_score: 0.12, estimated_weight_kg: 6.0,  waste_category: 'glass',      waste_category_colour: '#06b6d4', predicted_full_at: null,                                         battery_level_pct: 97, last_reading_at: new Date(NOW - 3600_000).toISOString(),  last_collected_at: new Date(NOW - 10 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-020', cluster_id: 'CLU-I', cluster_name: 'Uyanwatta West',    zone_id: 3, zone_name: 'Uyanwatta',      lat: 6.7984, lng: 79.8957, address: '61 Panadura Road',        fill_level_pct: 68, status: 'monitor',  urgency_score: 0.68, estimated_weight_kg: 34.0, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(NOW + 7 * 3600_000).toISOString(),  battery_level_pct: 72, last_reading_at: new Date(NOW - 750_000).toISOString(),   last_collected_at: new Date(NOW - 42 * 3600_000).toISOString(), has_active_job: false },
]

export const MOCK_VEHICLE_POSITIONS: VehiclePositionPayload[] = [
  { vehicle_id: 'VEH-001', driver_id: 'DRV-001', lat: 6.7978, lng: 79.8860, speed_kmh: 22, heading_degrees: 45,  job_id: 'JOB-001', zone_id: 1, current_cluster: 'CLU-B', next_cluster: 'CLU-C', bins_collected: 3, bins_total: 7, cargo_weight_kg: 108, cargo_limit_kg: 500, cargo_utilisation_pct: 21.6, weight_limit_warning: false },
  { vehicle_id: 'VEH-002', driver_id: 'DRV-002', lat: 6.7913, lng: 79.8895, speed_kmh: 18, heading_degrees: 180, job_id: 'JOB-002', zone_id: 2, current_cluster: 'CLU-E', next_cluster: 'CLU-F', bins_collected: 5, bins_total: 7, cargo_weight_kg: 196, cargo_limit_kg: 500, cargo_utilisation_pct: 39.2, weight_limit_warning: false },
  { vehicle_id: 'VEH-003', driver_id: 'DRV-003', lat: 6.8006, lng: 79.8933, speed_kmh: 0,  heading_degrees: 270, job_id: 'JOB-003', zone_id: 3, current_cluster: 'CLU-G', next_cluster: 'CLU-H', bins_collected: 1, bins_total: 6, cargo_weight_kg: 42,  cargo_limit_kg: 500, cargo_utilisation_pct: 8.4,  weight_limit_warning: false },
]

export const MOCK_VEHICLES_REST: ActiveVehicle[] = [
  { vehicle_id: 'VEH-001', vehicle_type: 'compactor', driver_id: 'DRV-001', driver_name: 'Amal Perera',    job_id: 'JOB-001', job_type: 'routine',   zone_id: 1, state: 'IN_PROGRESS', current_lat: 6.7978, current_lng: 79.8860, last_seen_at: new Date(NOW - 60_000).toISOString(),   cargo_weight_kg: 108, cargo_limit_kg: 500, cargo_utilisation_pct: 21.6, bins_collected: 3, bins_total: 7 },
  { vehicle_id: 'VEH-002', vehicle_type: 'compactor', driver_id: 'DRV-002', driver_name: 'Nimal Silva',    job_id: 'JOB-002', job_type: 'emergency', zone_id: 2, state: 'IN_PROGRESS', current_lat: 6.7913, current_lng: 79.8895, last_seen_at: new Date(NOW - 30_000).toISOString(),   cargo_weight_kg: 196, cargo_limit_kg: 500, cargo_utilisation_pct: 39.2, bins_collected: 5, bins_total: 7 },
  { vehicle_id: 'VEH-003', vehicle_type: 'mini_truck', driver_id: 'DRV-003', driver_name: 'Kasun Fernando', job_id: 'JOB-003', job_type: 'routine',   zone_id: 3, state: 'IN_PROGRESS', current_lat: 6.8006, current_lng: 79.8933, last_seen_at: new Date(NOW - 90_000).toISOString(),   cargo_weight_kg: 42,  cargo_limit_kg: 500, cargo_utilisation_pct: 8.4,  bins_collected: 1, bins_total: 6 },
]

export const MOCK_JOBS: CollectionJobListItem[] = [
  // Active jobs
  { id: 'JOB-001', job_type: 'routine',   zone_id: 1, zone_name: 'Katubedda',       state: 'IN_PROGRESS',    priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-A','CLU-B','CLU-C'], planned_weight_kg: 280,  actual_weight_kg: 108,  bins_total: 7, bins_collected: 3, bins_skipped: 0, created_at: new Date(NOW - 2   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
  { id: 'JOB-002', job_type: 'emergency', zone_id: 2, zone_name: 'Moratuwa South',  state: 'IN_PROGRESS',    priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-D','CLU-E','CLU-F'], planned_weight_kg: 320,  actual_weight_kg: 196,  bins_total: 7, bins_collected: 5, bins_skipped: 0, created_at: new Date(NOW - 3   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
  { id: 'JOB-003', job_type: 'routine',   zone_id: 3, zone_name: 'Uyanwatta',       state: 'DISPATCHED',     priority: 3, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-G','CLU-H','CLU-I'], planned_weight_kg: 240,  actual_weight_kg: 42,   bins_total: 6, bins_collected: 1, bins_skipped: 0, created_at: new Date(NOW - 1   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
  // Completed jobs (feed CollectionEfficiencyChart + VehicleUtilisationChart)
  { id: 'JOB-004', job_type: 'routine',   zone_id: 1, zone_name: 'Katubedda',       state: 'COMPLETED',      priority: 3, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-A'],                planned_weight_kg: 150,  actual_weight_kg: 143,  bins_total: 4, bins_collected: 4, bins_skipped: 0, created_at: new Date(NOW - 28  * 3600_000).toISOString(), completed_at: new Date(NOW - 24  * 3600_000).toISOString(), duration_minutes: 95  },
  { id: 'JOB-005', job_type: 'routine',   zone_id: 2, zone_name: 'Moratuwa South',  state: 'COMPLETED',      priority: 3, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-D','CLU-E'],         planned_weight_kg: 200,  actual_weight_kg: 187,  bins_total: 5, bins_collected: 5, bins_skipped: 0, created_at: new Date(NOW - 50  * 3600_000).toISOString(), completed_at: new Date(NOW - 46  * 3600_000).toISOString(), duration_minutes: 78  },
  { id: 'JOB-006', job_type: 'emergency', zone_id: 1, zone_name: 'Katubedda',       state: 'COMPLETED',      priority: 1, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-B'],                planned_weight_kg: 120,  actual_weight_kg: 115,  bins_total: 3, bins_collected: 3, bins_skipped: 0, created_at: new Date(NOW - 72  * 3600_000).toISOString(), completed_at: new Date(NOW - 70  * 3600_000).toISOString(), duration_minutes: 42  },
  { id: 'JOB-007', job_type: 'routine',   zone_id: 3, zone_name: 'Uyanwatta',       state: 'COMPLETED',      priority: 2, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-G','CLU-H'],         planned_weight_kg: 180,  actual_weight_kg: 172,  bins_total: 4, bins_collected: 4, bins_skipped: 0, created_at: new Date(NOW - 96  * 3600_000).toISOString(), completed_at: new Date(NOW - 92  * 3600_000).toISOString(), duration_minutes: 110 },
  { id: 'JOB-008', job_type: 'routine',   zone_id: 1, zone_name: 'Katubedda',       state: 'COMPLETED',      priority: 3, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-A','CLU-C'],         planned_weight_kg: 160,  actual_weight_kg: 154,  bins_total: 4, bins_collected: 4, bins_skipped: 0, created_at: new Date(NOW - 120 * 3600_000).toISOString(), completed_at: new Date(NOW - 116 * 3600_000).toISOString(), duration_minutes: 88  },
  { id: 'JOB-009', job_type: 'routine',   zone_id: 2, zone_name: 'Moratuwa South',  state: 'AUDIT_RECORDED', priority: 3, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-F'],                planned_weight_kg: 100,  actual_weight_kg: 94,   bins_total: 3, bins_collected: 3, bins_skipped: 0, created_at: new Date(NOW - 144 * 3600_000).toISOString(), completed_at: new Date(NOW - 140 * 3600_000).toISOString(), duration_minutes: 55  },
  { id: 'JOB-010', job_type: 'emergency', zone_id: 3, zone_name: 'Uyanwatta',       state: 'COMPLETED',      priority: 1, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-I'],                planned_weight_kg: 80,   actual_weight_kg: 76,   bins_total: 2, bins_collected: 2, bins_skipped: 0, created_at: new Date(NOW - 168 * 3600_000).toISOString(), completed_at: new Date(NOW - 167 * 3600_000).toISOString(), duration_minutes: 35  },
  { id: 'JOB-011', job_type: 'routine',   zone_id: 1, zone_name: 'Katubedda',       state: 'COMPLETED',      priority: 3, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-A','CLU-B','CLU-C'], planned_weight_kg: 290,  actual_weight_kg: 261,  bins_total: 7, bins_collected: 6, bins_skipped: 1, created_at: new Date(NOW - 192 * 3600_000).toISOString(), completed_at: new Date(NOW - 188 * 3600_000).toISOString(), duration_minutes: 125 },
  // Escalated job
  { id: 'JOB-012', job_type: 'emergency', zone_id: 2, zone_name: 'Moratuwa South',  state: 'ESCALATED',      priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-D','CLU-E','CLU-F'], planned_weight_kg: 340,  actual_weight_kg: null, bins_total: 8, bins_collected: 2, bins_skipped: 1, created_at: new Date(NOW - 4   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
  // Cancelled / Failed jobs
  { id: 'JOB-013', job_type: 'routine',   zone_id: 3, zone_name: 'Uyanwatta',       state: 'CANCELLED',      priority: 3, assigned_vehicle_id: null,       assigned_driver_id: null,       clusters: ['CLU-H','CLU-I'],         planned_weight_kg: 130,  actual_weight_kg: null, bins_total: 3, bins_collected: 0, bins_skipped: 0, created_at: new Date(NOW - 6   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
  { id: 'JOB-014', job_type: 'routine',   zone_id: 1, zone_name: 'Katubedda',       state: 'FAILED',         priority: 2, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-C'],                planned_weight_kg: 90,   actual_weight_kg: null, bins_total: 2, bins_collected: 0, bins_skipped: 0, created_at: new Date(NOW - 8   * 3600_000).toISOString(), completed_at: null,                                                       duration_minutes: null },
]

const ZONE_SUMMARIES: Record<number, ZoneSummary> = {
  1: { zone_id: 1, zone_name: 'Katubedda',      total_bins: 7, total_clusters: 3, status_breakdown: { normal: 2, monitor: 1, urgent: 2, critical: 1, offline: 1 }, category_breakdown: { food_waste: { total_bins: 2, avg_fill_pct: 76, total_weight_kg: 76.5, urgent_count: 2 }, paper: { total_bins: 1, avg_fill_pct: 45, total_weight_kg: 22.5, urgent_count: 0 }, general: { total_bins: 1, avg_fill_pct: 95, total_weight_kg: 47.5, urgent_count: 1 }, plastic: { total_bins: 1, avg_fill_pct: 58, total_weight_kg: 29.0, urgent_count: 0 }, glass: { total_bins: 1, avg_fill_pct: 22, total_weight_kg: 11.0, urgent_count: 0 } }, total_estimated_weight_kg: 186.5, active_jobs_count: 1, last_updated: new Date(NOW - 300_000).toISOString() },
  2: { zone_id: 2, zone_name: 'Moratuwa South', total_bins: 7, total_clusters: 3, status_breakdown: { normal: 3, monitor: 2, urgent: 0, critical: 2, offline: 0 }, category_breakdown: { food_waste: { total_bins: 2, avg_fill_pct: 89, total_weight_kg: 89.5, urgent_count: 2 }, paper: { total_bins: 2, avg_fill_pct: 37, total_weight_kg: 37.0, urgent_count: 0 }, plastic: { total_bins: 1, avg_fill_pct: 51, total_weight_kg: 25.5, urgent_count: 0 }, glass: { total_bins: 1, avg_fill_pct: 18, total_weight_kg: 9.0, urgent_count: 0 }, general: { total_bins: 1, avg_fill_pct: 63, total_weight_kg: 31.5, urgent_count: 0 } }, total_estimated_weight_kg: 192.5, active_jobs_count: 1, last_updated: new Date(NOW - 180_000).toISOString() },
  3: { zone_id: 3, zone_name: 'Uyanwatta',      total_bins: 6, total_clusters: 3, status_breakdown: { normal: 2, monitor: 2, urgent: 2, critical: 0, offline: 0 }, category_breakdown: { food_waste: { total_bins: 2, avg_fill_pct: 72, total_weight_kg: 72.0, urgent_count: 1 }, plastic: { total_bins: 1, avg_fill_pct: 29, total_weight_kg: 14.5, urgent_count: 0 }, e_waste: { total_bins: 1, avg_fill_pct: 55, total_weight_kg: 27.5, urgent_count: 0 }, general: { total_bins: 1, avg_fill_pct: 85, total_weight_kg: 42.5, urgent_count: 1 }, glass: { total_bins: 1, avg_fill_pct: 12, total_weight_kg: 6.0, urgent_count: 0 } }, total_estimated_weight_kg: 162.5, active_jobs_count: 1, last_updated: new Date(NOW - 420_000).toISOString() },
}

const MOCK_METADATA_ZONES = Object.values(ZONE_SUMMARIES).map((zone) => ({
  id: zone.zone_id,
  name: zone.zone_name,
  code: `ZONE-${String(zone.zone_id).padStart(2, '0')}`,
  active: true,
}))

const MOCK_WASTE_CATEGORIES = [
  { id: 1, name: 'food_waste', colour_code: '#8B4513', recyclable: false, special_handling: false },
  { id: 2, name: 'paper', colour_code: '#4169E1', recyclable: true, special_handling: false },
  { id: 3, name: 'glass', colour_code: '#228B22', recyclable: true, special_handling: false },
  { id: 4, name: 'plastic', colour_code: '#FF6347', recyclable: true, special_handling: false },
  { id: 5, name: 'general', colour_code: '#808080', recyclable: false, special_handling: false },
  { id: 6, name: 'e_waste', colour_code: '#FFD700', recyclable: false, special_handling: true },
]

type MetadataCluster = {
  id: string
  zone_id: number
  name: string
  lat: number
  lng: number
  address: string
  cluster_type: string
  active: boolean
  zone: { id: number; name: string; code: string }
  bins: Array<{ id: string; waste_category_id: number; volume_litres: number }>
}

const EXTRA_METADATA_CLUSTERS: MetadataCluster[] = []

function metadataClusters(): MetadataCluster[] {
  const byId = new Map<string, MetadataCluster>()

  MOCK_BINS.forEach((bin) => {
    const zone = MOCK_METADATA_ZONES.find((z) => z.id === bin.zone_id)
    if (!byId.has(bin.cluster_id)) {
      byId.set(bin.cluster_id, {
        id: bin.cluster_id,
        zone_id: bin.zone_id,
        name: bin.cluster_name,
        lat: bin.lat,
        lng: bin.lng,
        address: bin.address,
        cluster_type: 'public_space',
        active: true,
        zone: {
          id: bin.zone_id,
          name: bin.zone_name,
          code: zone?.code ?? `ZONE-${bin.zone_id}`,
        },
        bins: [],
      })
    }
    byId.get(bin.cluster_id)!.bins.push({
      id: bin.bin_id,
      waste_category_id: MOCK_WASTE_CATEGORIES.find((category) => category.name === bin.waste_category)?.id ?? 5,
      volume_litres: 240,
    })
  })

  return [...byId.values(), ...EXTRA_METADATA_CLUSTERS]
}

function metadataBins() {
  return MOCK_BINS.map((bin) => ({
    id: bin.bin_id,
    cluster_id: bin.cluster_id,
    waste_category_id: MOCK_WASTE_CATEGORIES.find((category) => category.name === bin.waste_category)?.id ?? 5,
    volume_litres: 240,
    lat: bin.lat,
    lng: bin.lng,
    address: bin.address,
    active: true,
    depth_cm: 120,
    cluster: {
      id: bin.cluster_id,
      name: bin.cluster_name,
      zone_id: bin.zone_id,
      lat: bin.lat,
      lng: bin.lng,
      zone: {
        id: bin.zone_id,
        name: bin.zone_name,
        code: MOCK_METADATA_ZONES.find((zone) => zone.id === bin.zone_id)?.code,
      },
    },
    waste_category: MOCK_WASTE_CATEGORIES.find((category) => category.name === bin.waste_category),
    current_state: {
      fill_level_pct: bin.fill_level_pct,
      battery_level_pct: bin.battery_level_pct,
      estimated_weight_kg: bin.estimated_weight_kg,
      status: bin.status,
      urgency_score: bin.urgency_score,
      predicted_full_at: bin.predicted_full_at,
      last_reading_at: bin.last_reading_at,
      last_collected_at: bin.last_collected_at,
    },
  }))
}

// Zone stats in socket payload shape — used by MockSocketInjector to seed the Zustand store
export const MOCK_ZONE_STATS: ZoneStatsPayload[] = [
  { zone_id: 1, zone_name: 'Katubedda',      avg_fill_level_pct: 61, urgent_bin_count: 2, critical_bin_count: 1, total_bins: 7, total_estimated_weight_kg: 186.5, dominant_waste_category: 'food_waste', category_breakdown: { food_waste: { count: 2, avg_fill: 76, total_kg: 76.5 }, paper: { count: 1, avg_fill: 45, total_kg: 22.5 }, general: { count: 1, avg_fill: 95, total_kg: 47.5 }, plastic: { count: 1, avg_fill: 58, total_kg: 29.0 }, glass: { count: 1, avg_fill: 22, total_kg: 11.0 } }, active_jobs_count: 1, unassigned_urgent_bins: 2 },
  { zone_id: 2, zone_name: 'Moratuwa South', avg_fill_level_pct: 56, urgent_bin_count: 0, critical_bin_count: 2, total_bins: 7, total_estimated_weight_kg: 192.5, dominant_waste_category: 'food_waste', category_breakdown: { food_waste: { count: 2, avg_fill: 89, total_kg: 89.5 }, paper: { count: 2, avg_fill: 37, total_kg: 37.0 }, plastic: { count: 1, avg_fill: 51, total_kg: 25.5 }, glass: { count: 1, avg_fill: 18, total_kg: 9.0 }, general: { count: 1, avg_fill: 63, total_kg: 31.5 } }, active_jobs_count: 1, unassigned_urgent_bins: 0 },
  { zone_id: 3, zone_name: 'Uyanwatta',      avg_fill_level_pct: 55, urgent_bin_count: 2, critical_bin_count: 0, total_bins: 6, total_estimated_weight_kg: 162.5, dominant_waste_category: 'food_waste', category_breakdown: { food_waste: { count: 2, avg_fill: 72, total_kg: 72.0 }, plastic: { count: 1, avg_fill: 29, total_kg: 14.5 }, e_waste: { count: 1, avg_fill: 55, total_kg: 27.5 }, general: { count: 1, avg_fill: 85, total_kg: 42.5 }, glass: { count: 1, avg_fill: 12, total_kg: 6.0 } }, active_jobs_count: 1, unassigned_urgent_bins: 2 },
]

function makeBinHistory(binId: string): BinHistory {
  const now = Date.now()
  const series = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(now - (23 - i) * 3600_000).toISOString(),
    fill_level_pct: Math.min(100, 10 + i * 3.5 + Math.random() * 5),
    urgency_score: Math.min(1, 0.1 + i * 0.035),
    estimated_weight_kg: Math.min(50, 5 + i * 1.8),
  }))
  return {
    bin_id: binId,
    from: new Date(now - 24 * 3600_000).toISOString(),
    to: new Date(now).toISOString(),
    interval: '1h',
    series,
    collection_events: [
      { collected_at: new Date(now - 48 * 3600_000).toISOString(), fill_level_at_collection: 88 },
    ],
  }
}

export const handlers = [
  http.get('/api/metadata/zones', () => {
    return HttpResponse.json({ data: MOCK_METADATA_ZONES, total: MOCK_METADATA_ZONES.length })
  }),

  http.post('/api/metadata/city-zones', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const zone = {
      id: MOCK_METADATA_ZONES.length ? Math.max(...MOCK_METADATA_ZONES.map((z) => z.id)) + 1 : 1,
      name: String(body.name),
      code: String(body.code),
      active: true,
    }
    MOCK_METADATA_ZONES.push(zone)
    return HttpResponse.json({ data: zone }, { status: 201 })
  }),

  http.patch('/api/metadata/city-zones/:zoneId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const zone = MOCK_METADATA_ZONES.find((z) => z.id === Number(params.zoneId))
    if (!zone) return HttpResponse.json({ message: 'Zone not found' }, { status: 404 })
    Object.assign(zone, body)
    return HttpResponse.json({ data: zone })
  }),

  http.delete('/api/metadata/city-zones/:zoneId', ({ params }) => {
    const index = MOCK_METADATA_ZONES.findIndex((z) => z.id === Number(params.zoneId))
    if (index >= 0) MOCK_METADATA_ZONES.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/metadata/clusters', ({ request }) => {
    const url = new URL(request.url)
    const zoneId = url.searchParams.get('zone_id')
    let data = metadataClusters()
    if (zoneId) data = data.filter((cluster) => cluster.zone_id === Number(zoneId))
    return HttpResponse.json({ data, pagination: { page: 1, limit: 50, total: data.length, pages: 1 } })
  }),

  http.post('/api/metadata/clusters', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const zone = MOCK_METADATA_ZONES.find((item) => item.id === Number(body.zone_id))
    const cluster = {
      id: String(body.id),
      zone_id: Number(body.zone_id),
      name: String(body.name),
      lat: Number(body.lat ?? 0),
      lng: Number(body.lng ?? 0),
      address: String(body.address ?? ''),
      cluster_type: String(body.cluster_type ?? 'public_space'),
      active: true,
      zone: {
        id: Number(body.zone_id),
        name: zone?.name ?? `Zone ${body.zone_id}`,
        code: zone?.code ?? `ZONE-${body.zone_id}`,
      },
      bins: [],
    }
    EXTRA_METADATA_CLUSTERS.push(cluster)
    return HttpResponse.json({ data: cluster }, { status: 201 })
  }),

  http.patch('/api/metadata/clusters/:clusterId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const cluster = EXTRA_METADATA_CLUSTERS.find((item: MetadataCluster) => item.id === String(params.clusterId))
    if (cluster) Object.assign(cluster, body)
    return HttpResponse.json({ data: { id: params.clusterId, ...body } })
  }),

  http.delete('/api/metadata/clusters/:clusterId', ({ params }) => {
    const index = EXTRA_METADATA_CLUSTERS.findIndex((item: MetadataCluster) => item.id === String(params.clusterId))
    if (index >= 0) EXTRA_METADATA_CLUSTERS.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/metadata/waste-categories', () => {
    return HttpResponse.json({ data: MOCK_WASTE_CATEGORIES })
  }),

  http.get('/api/metadata/bins', ({ request }) => {
    const url = new URL(request.url)
    const zoneId = url.searchParams.get('zone_id')
    const clusterId = url.searchParams.get('cluster_id')
    let data = metadataBins()
    if (zoneId) data = data.filter((bin) => bin.cluster.zone_id === Number(zoneId))
    if (clusterId) data = data.filter((bin) => bin.cluster_id === clusterId)
    return HttpResponse.json({ data, pagination: { page: 1, limit: 50, total: data.length, pages: 1 } })
  }),

  http.post('/api/metadata/bins', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const cluster = metadataClusters().find((item: MetadataCluster) => item.id === String(body.cluster_id))
    const category = MOCK_WASTE_CATEGORIES.find((item) => item.id === Number(body.waste_category_id)) ?? MOCK_WASTE_CATEGORIES[4]
    const bin = {
      bin_id: String(body.id),
      cluster_id: String(body.cluster_id),
      cluster_name: cluster?.name ?? String(body.cluster_id),
      zone_id: cluster?.zone_id ?? 1,
      zone_name: cluster?.zone.name ?? 'Zone 1',
      lat: Number(body.lat ?? cluster?.lat ?? 0),
      lng: Number(body.lng ?? cluster?.lng ?? 0),
      address: String(body.address ?? cluster?.address ?? ''),
      fill_level_pct: 0,
      status: 'normal' as const,
      urgency_score: 0,
      estimated_weight_kg: 0,
      waste_category: category.name as typeof MOCK_BINS[number]['waste_category'],
      waste_category_colour: category.colour_code,
      predicted_full_at: null,
      battery_level_pct: 100,
      last_reading_at: new Date().toISOString(),
      last_collected_at: null,
      has_active_job: false,
    }
    MOCK_BINS.push(bin)
    return HttpResponse.json({ data: metadataBins().find((item) => item.id === bin.bin_id) }, { status: 201 })
  }),

  http.patch('/api/metadata/bins/:binId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ data: { id: params.binId, ...body } })
  }),

  http.delete('/api/metadata/bins/:binId', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/v1/bins — supports ?zone_id= ?status= ?waste_category= ?page= ?limit=
  http.get('/api/v1/bins', ({ request }) => {
    const url      = new URL(request.url)
    const zoneId   = url.searchParams.get('zone_id')
    const status   = url.searchParams.get('status')
    const category = url.searchParams.get('waste_category')
    const page     = Math.max(1, Number(url.searchParams.get('page')  ?? 1))
    const limit    = Math.max(1, Number(url.searchParams.get('limit') ?? 25))
    let filtered   = MOCK_BINS
    if (zoneId)   filtered = filtered.filter((b) => b.zone_id       === Number(zoneId))
    if (status)   filtered = filtered.filter((b) => b.status        === status)
    if (category) filtered = filtered.filter((b) => b.waste_category === category)
    const total = filtered.length
    const data  = filtered.slice((page - 1) * limit, page * limit)
    return HttpResponse.json({ data, total, page, limit })
  }),

  // GET /api/v1/bins/:binId
  http.get('/api/v1/bins/:binId', ({ params }) => {
    const bin = MOCK_BINS.find((b) => b.bin_id === params.binId)
    if (!bin) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...bin,
      recent_collections: [
        { job_id: 'JOB-004', collected_at: new Date(Date.now() - 48 * 3600_000).toISOString(), driver_id: 'DRV-001', fill_level_at_collection: 87, actual_weight_kg: 43.5, job_type: 'routine' },
      ],
    })
  }),

  // GET /api/v1/bins/:binId/history
  http.get('/api/v1/bins/:binId/history', ({ params }) => {
    return HttpResponse.json(makeBinHistory(params.binId as string))
  }),

  // GET /api/v1/zones — returns all zone summaries
  http.get('/api/v1/zones', () => {
    const data = Object.values(ZONE_SUMMARIES)
    return HttpResponse.json({ data, total: data.length })
  }),

  // GET /api/v1/zones/:zoneId/summary
  http.get('/api/v1/zones/:zoneId/summary', ({ params }) => {
    const summary = ZONE_SUMMARIES[Number(params.zoneId)]
    if (!summary) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(summary)
  }),

  // GET /api/v1/collection-jobs — supports ?state= (comma-separated), ?zone_id=, ?job_type=
  http.get('/api/v1/collection-jobs', ({ request }) => {
    const url      = new URL(request.url)
    const stateRaw = url.searchParams.get('state')
    const zoneId   = url.searchParams.get('zone_id')
    const jobType  = url.searchParams.get('job_type')
    const states   = stateRaw ? stateRaw.split(',').map((s) => s.trim()) : null
    let filtered   = MOCK_JOBS
    if (states)  filtered = filtered.filter((j) => states.includes(j.state))
    if (zoneId)  filtered = filtered.filter((j) => j.zone_id  === Number(zoneId))
    if (jobType) filtered = filtered.filter((j) => j.job_type === jobType)
    return HttpResponse.json({ data: filtered, total: filtered.length, page: 1 })
  }),

  // GET /api/v1/collection-jobs/:jobId
  http.get('/api/v1/collection-jobs/:jobId', ({ params }) => {
    const job = MOCK_JOBS.find((j) => j.id === params.jobId)
    if (!job) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(job)
  }),

  // GET /api/v1/vehicles/active
  http.get('/api/v1/vehicles/active', () => {
    return HttpResponse.json({ vehicles: MOCK_VEHICLES_REST })
  }),

  // GET /api/v1/ml/waste-generation
  http.get('/api/v1/ml/waste-generation', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return HttpResponse.json({
      predictions: days.map((day, i) => ({
        day,
        predicted_kg: 800 + i * 40 + Math.random() * 80,
        confidence: 0.82 + Math.random() * 0.1,
      })),
    })
  }),

  // GET /api/v1/ml/trends/waste-generation — returns WasteGenerationTrend for one zone
  http.get('/api/v1/ml/trends/waste-generation', ({ request }) => {
    const url    = new URL(request.url)
    const zoneId = Number(url.searchParams.get('zone_id') ?? 1)
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const ZONE_BASES: Record<number, number> = { 1: 52, 2: 48, 3: 45 }
    const base = ZONE_BASES[zoneId] ?? 50
    const series = DAY_LABELS.map((label, i) => ({
      label,
      food_waste: parseFloat((base * 0.35 + i * 1.2 + Math.random() * 4).toFixed(1)),
      paper:      parseFloat((base * 0.18 + i * 0.5 + Math.random() * 2).toFixed(1)),
      glass:      parseFloat((base * 0.08 + i * 0.2 + Math.random() * 1).toFixed(1)),
      plastic:    parseFloat((base * 0.12 + i * 0.4 + Math.random() * 2).toFixed(1)),
      general:    parseFloat((base * 0.20 + i * 0.7 + Math.random() * 3).toFixed(1)),
      e_waste:    parseFloat((base * 0.07 + i * 0.1 + Math.random() * 0.5).toFixed(1)),
    }))
    return HttpResponse.json({ zone_id: zoneId, period: 'week', series, model_version: 'v1.0-mock' })
  }),

  // GET /api/v1/ml/predict/zone-generation — returns ZoneGenerationPrediction for one zone
  http.get('/api/v1/ml/predict/zone-generation', ({ request }) => {
    const url    = new URL(request.url)
    const zoneId = Number(url.searchParams.get('zone_id') ?? 1)
    const ZONE_BASES: Record<number, number> = { 1: 67, 2: 62, 3: 58 }
    const base = ZONE_BASES[zoneId] ?? 60
    return HttpResponse.json({
      zone_id:              zoneId,
      date_range:           'next_7_days',
      predicted_kg_per_day: parseFloat(base.toFixed(1)),
      by_waste_category: {
        food_waste: parseFloat((base * 0.35).toFixed(1)),
        paper:      parseFloat((base * 0.18).toFixed(1)),
        glass:      parseFloat((base * 0.08).toFixed(1)),
        plastic:    parseFloat((base * 0.12).toFixed(1)),
        general:    parseFloat((base * 0.20).toFixed(1)),
        e_waste:    parseFloat((base * 0.07).toFixed(1)),
      },
      model_version: 'v1.0-mock',
    })
  }),

  // GET /api/v1/ml/fill-time/:binId
  http.get('/api/v1/ml/fill-time/:binId', ({ params }) => {
    return HttpResponse.json({
      bin_id: params.binId,
      predicted_full_at: new Date(Date.now() + 8 * 3600_000).toISOString(),
      confidence: 0.87,
      model_version: 'v2.1',
    })
  }),

  // POST /api/v1/bins
  http.post('/api/v1/bins', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, bin_id: body.bin_id ?? `BIN-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/bins/:binId
  http.patch('/api/v1/bins/:binId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ bin_id: params.binId, ...body })
  }),

  // GET /api/v1/vehicles
  http.get('/api/v1/vehicles', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  // POST /api/v1/vehicles
  http.post('/api/v1/vehicles', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, vehicle_id: body.vehicle_id ?? `VEH-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/vehicles/:vehicleId
  http.patch('/api/v1/vehicles/:vehicleId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ vehicle_id: params.vehicleId, ...body })
  }),

  // GET /api/v1/drivers
  http.get('/api/v1/drivers', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  // POST /api/v1/drivers
  http.post('/api/v1/drivers', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, driver_id: `DRV-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/drivers/:driverId
  http.patch('/api/v1/drivers/:driverId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ driver_id: params.driverId, ...body })
  }),

  // GET /api/v1/collections/:id/progress
  http.get('/api/v1/collections/:id/progress', ({ params }) => {
    return HttpResponse.json({
      collection_id: params.id,
      completed_stops: 3,
      total_stops: 8,
      collected_weight_kg: 112,
      current_location: null,
    })
  }),
]
