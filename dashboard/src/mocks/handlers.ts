import { http, HttpResponse } from 'msw'
import type { Bin, ZoneSummary, BinHistory, ZoneStatsPayload } from '@/types'
import type { ActiveVehicle, Driver, VehicleAsset, VehiclePositionPayload } from '@/types'
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

// Vehicle and Driver mock data removed


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
  // api/metadata/... handlers removed — BinsTab now calls data-analysis/api/v1/... (Core API via Kong)
  // Mock data arrays above kept for reference.

  // GET /api/v1/bins — unwired: falls through to real bin-status service
  // (MOCK_BINS data kept above for reference; re-wire by restoring these handlers)

  // GET /api/v1/bins/:binId/history
  http.get('http://localhost:30080/api/v1/bins/:binId/history', ({ params }) => {
    return HttpResponse.json(makeBinHistory(params.binId as string))
  }),

  // GET /api/v1/zones — returns all zone summaries
  http.get('http://localhost:30080/api/v1/zones', () => {
    const data = Object.values(ZONE_SUMMARIES)
    return HttpResponse.json({ data, total: data.length })
  }),

  // GET /api/v1/zones/:zoneId/summary
  http.get('http://localhost:30080/api/v1/zones/:zoneId/summary', ({ params }) => {
    const summary = ZONE_SUMMARIES[Number(params.zoneId)]
    if (!summary) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(summary)
  }),

  // GET /api/v1/collection-jobs — supports ?state= (comma-separated), ?zone_id=, ?job_type=
  http.get('http://localhost:30080/api/v1/collection-jobs', ({ request }) => {
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
  http.get('http://localhost:30080/api/v1/collection-jobs/:jobId', ({ params }) => {
    const job = MOCK_JOBS.find((j) => j.id === params.jobId)
    if (!job) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(job)
  }),

  // Active vehicles handler removed


  // GET /api/v1/ml/waste-generation
  http.get('http://localhost:30080/api/v1/ml/waste-generation', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return HttpResponse.json({
      predictions: days.map((day, i) => ({
        day,
        predicted_kg: 800 + i * 40 + Math.random() * 80,
        confidence: 0.82 + Math.random() * 0.1,
      })),
    })
  }),

  // GET /api/v1/ml/trends/waste-generation — feeds ZoneFillTrendsChart + FillRateHeatmap
  http.get('http://localhost:30080/api/v1/ml/trends/waste-generation', ({ request }) => {
    const url  = new URL(request.url)
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days') ?? 7)))
    const now  = Date.now()
    const ZONE_BASES = [
      { zone_id: 1, zone_name: 'Katubedda',      base: 52 },
      { zone_id: 2, zone_name: 'Moratuwa South', base: 48 },
      { zone_id: 3, zone_name: 'Uyanwatta',      base: 45 },
    ]
    // One data point per zone per day (plus hourly noise for heatmap)
    const series = ZONE_BASES.flatMap((z) =>
      Array.from({ length: days * 4 }, (_, i) => {
        const dayOffset = Math.floor(i / 4)
        const hourOffset = (i % 4) * 6
        const trend = dayOffset * 3.2
        const hourBump = hourOffset >= 12 && hourOffset <= 18 ? 8 : 0
        return {
          timestamp:    new Date(now - (days - 1 - dayOffset) * 86_400_000 + hourOffset * 3_600_000).toISOString(),
          zone_id:      z.zone_id,
          zone_name:    z.zone_name,
          avg_fill_pct: parseFloat(Math.min(95, Math.max(10,
            z.base + trend + hourBump + (Math.random() - 0.5) * 6,
          )).toFixed(1)),
        }
      })
    )
    return HttpResponse.json({ series, generated_at: new Date().toISOString() })
  }),

  // GET /api/v1/ml/predict/zone-generation — feeds ZoneForecastChart
  http.get('http://localhost:30080/api/v1/ml/predict/zone-generation', ({ request }) => {
    const url    = new URL(request.url)
    const zoneId = Number(url.searchParams.get('zone_id') ?? 1)
    const ZONE_NAMES: Record<number, string> = { 1: 'Katubedda', 2: 'Moratuwa South', 3: 'Uyanwatta' }
    const ZONE_BASES: Record<number, number> = { 1: 55, 2: 50, 3: 47 }
    const base   = ZONE_BASES[zoneId] ?? 50
    const now    = Date.now()
    const forecasts = Array.from({ length: 7 }, (_, i) => {
      const predicted = Math.min(95, base + (i + 1) * 5.5 + (Math.random() - 0.5) * 4)
      const margin    = 8 + i * 0.5
      return {
        date:      new Date(now + (i + 1) * 86_400_000).toISOString().slice(0, 10),
        predicted: parseFloat(predicted.toFixed(1)),
        lower_ci:  parseFloat(Math.max(0,   predicted - margin).toFixed(1)),
        upper_ci:  parseFloat(Math.min(100, predicted + margin).toFixed(1)),
      }
    })
    return HttpResponse.json({
      zone_id:   zoneId,
      zone_name: ZONE_NAMES[zoneId] ?? `Zone ${zoneId}`,
      forecasts,
    })
  }),

  // GET /api/v1/ml/fill-time/:binId
  http.get('http://localhost:30080/api/v1/ml/fill-time/:binId', ({ params }) => {
    return HttpResponse.json({
      bin_id: params.binId,
      predicted_full_at: new Date(Date.now() + 8 * 3600_000).toISOString(),
      confidence: 0.87,
      model_version: 'v2.1',
    })
  }),

  // POST /api/v1/bins
  http.post('http://localhost:30080/api/v1/bins', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, bin_id: body.bin_id ?? `BIN-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/bins/:binId
  http.patch('http://localhost:30080/api/v1/bins/:binId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ bin_id: params.binId, ...body })
  }),

  // Vehicle and Driver handlers removed — now calling real backend services


  // GET /api/v1/zones
  http.get('http://localhost:30080/api/v1/zones', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  // GET /api/v1/collections/:id/progress
  http.get('http://localhost:30080/api/v1/collections/:id/progress', ({ params }) => {
    return HttpResponse.json({
      collection_id: params.id,
      completed_stops: 3,
      total_stops: 8,
      collected_weight_kg: 112,
      current_location: null,
    })
  }),
]
