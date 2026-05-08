import { http, HttpResponse } from 'msw'
import type { Bin, ZoneSummary, BinHistory } from '@/types'
import type { ActiveVehicle } from '@/types'
import type { CollectionJobListItem, CollectionJobDetail } from '@/types'

const BASE = 'http://localhost:30080'

// ─────────────────────────────────────────────────────────────────────────────
// MOCK BINS  (4 zones × KL areas)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_BINS: Bin[] = [
  // Zone 1 — KLCC
  { bin_id: 'BIN-001', cluster_id: 'CLU-01', cluster_name: 'KLCC North', zone_id: 1, zone_name: 'KLCC', lat: 3.1580, lng: 101.7120, address: 'Jln Ampang, KLCC', fill_level_pct: 92, status: 'critical', urgency_score: 0.95, estimated_weight_kg: 46, waste_category: 'general', waste_category_colour: '#6b7280', predicted_full_at: new Date(Date.now() + 2 * 3600_000).toISOString(), battery_level_pct: 81, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 48 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-002', cluster_id: 'CLU-01', cluster_name: 'KLCC North', zone_id: 1, zone_name: 'KLCC', lat: 3.1572, lng: 101.7134, address: 'Suria KLCC Entrance', fill_level_pct: 78, status: 'urgent', urgency_score: 0.77, estimated_weight_kg: 39, waste_category: 'plastic', waste_category_colour: '#3b82f6', predicted_full_at: new Date(Date.now() + 6 * 3600_000).toISOString(), battery_level_pct: 64, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 36 * 3600_000).toISOString(), has_active_job: true },
  { bin_id: 'BIN-003', cluster_id: 'CLU-02', cluster_name: 'KLCC South', zone_id: 1, zone_name: 'KLCC', lat: 3.1556, lng: 101.7108, address: 'Jln P Ramlee', fill_level_pct: 45, status: 'monitor', urgency_score: 0.42, estimated_weight_kg: 22, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(Date.now() + 18 * 3600_000).toISOString(), battery_level_pct: 92, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 24 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-004', cluster_id: 'CLU-02', cluster_name: 'KLCC South', zone_id: 1, zone_name: 'KLCC', lat: 3.1563, lng: 101.7095, address: 'Jln Sultan Ismail', fill_level_pct: 20, status: 'normal', urgency_score: 0.18, estimated_weight_kg: 10, waste_category: 'paper', waste_category_colour: '#eab308', predicted_full_at: null, battery_level_pct: 77, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 12 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-005', cluster_id: 'CLU-02', cluster_name: 'KLCC South', zone_id: 1, zone_name: 'KLCC', lat: 3.1545, lng: 101.7150, address: 'Petronas Twin Towers', fill_level_pct: 5, status: 'offline', urgency_score: 0.0, estimated_weight_kg: 2, waste_category: 'general', waste_category_colour: '#6b7280', predicted_full_at: null, battery_level_pct: 8, last_reading_at: new Date(Date.now() - 4 * 3600_000).toISOString(), last_collected_at: new Date(Date.now() - 72 * 3600_000).toISOString(), has_active_job: false },
  // Zone 2 — Chow Kit
  { bin_id: 'BIN-006', cluster_id: 'CLU-03', cluster_name: 'Chow Kit Market', zone_id: 2, zone_name: 'Chow Kit', lat: 3.1630, lng: 101.7010, address: 'Pasar Chow Kit', fill_level_pct: 88, status: 'critical', urgency_score: 0.90, estimated_weight_kg: 44, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(Date.now() + 3 * 3600_000).toISOString(), battery_level_pct: 55, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 60 * 3600_000).toISOString(), has_active_job: true },
  { bin_id: 'BIN-007', cluster_id: 'CLU-03', cluster_name: 'Chow Kit Market', zone_id: 2, zone_name: 'Chow Kit', lat: 3.1621, lng: 101.7028, address: 'Jln Raja Laut', fill_level_pct: 65, status: 'urgent', urgency_score: 0.66, estimated_weight_kg: 32, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(Date.now() + 10 * 3600_000).toISOString(), battery_level_pct: 70, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 30 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-008', cluster_id: 'CLU-04', cluster_name: 'Chow Kit Residential', zone_id: 2, zone_name: 'Chow Kit', lat: 3.1608, lng: 101.6988, address: 'Jln Tuanku Abdul Halim', fill_level_pct: 33, status: 'monitor', urgency_score: 0.30, estimated_weight_kg: 16, waste_category: 'general', waste_category_colour: '#6b7280', predicted_full_at: null, battery_level_pct: 88, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 20 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-009', cluster_id: 'CLU-04', cluster_name: 'Chow Kit Residential', zone_id: 2, zone_name: 'Chow Kit', lat: 3.1597, lng: 101.6975, address: 'Jln Pahang', fill_level_pct: 15, status: 'normal', urgency_score: 0.12, estimated_weight_kg: 7, waste_category: 'plastic', waste_category_colour: '#3b82f6', predicted_full_at: null, battery_level_pct: 95, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 8 * 3600_000).toISOString(), has_active_job: false },
  // Zone 3 — Brickfields
  { bin_id: 'BIN-010', cluster_id: 'CLU-05', cluster_name: 'Brickfields Core', zone_id: 3, zone_name: 'Brickfields', lat: 3.1348, lng: 101.6872, address: 'Jln Tun Sambanthan', fill_level_pct: 72, status: 'urgent', urgency_score: 0.71, estimated_weight_kg: 36, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(Date.now() + 8 * 3600_000).toISOString(), battery_level_pct: 60, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 40 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-011', cluster_id: 'CLU-05', cluster_name: 'Brickfields Core', zone_id: 3, zone_name: 'Brickfields', lat: 3.1360, lng: 101.6885, address: 'KL Sentral Station', fill_level_pct: 55, status: 'monitor', urgency_score: 0.52, estimated_weight_kg: 27, waste_category: 'general', waste_category_colour: '#6b7280', predicted_full_at: new Date(Date.now() + 14 * 3600_000).toISOString(), battery_level_pct: 73, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 28 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-012', cluster_id: 'CLU-06', cluster_name: 'Brickfields South', zone_id: 3, zone_name: 'Brickfields', lat: 3.1330, lng: 101.6860, address: 'Little India, Brickfields', fill_level_pct: 25, status: 'normal', urgency_score: 0.22, estimated_weight_kg: 12, waste_category: 'glass', waste_category_colour: '#22c55e', predicted_full_at: null, battery_level_pct: 84, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 16 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-013', cluster_id: 'CLU-06', cluster_name: 'Brickfields South', zone_id: 3, zone_name: 'Brickfields', lat: 3.1315, lng: 101.6848, address: 'Jln Thambipillay', fill_level_pct: 40, status: 'monitor', urgency_score: 0.38, estimated_weight_kg: 20, waste_category: 'e_waste', waste_category_colour: '#8b5cf6', predicted_full_at: null, battery_level_pct: 67, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 22 * 3600_000).toISOString(), has_active_job: false },
  // Zone 4 — Bangsar
  { bin_id: 'BIN-014', cluster_id: 'CLU-07', cluster_name: 'Bangsar Village', zone_id: 4, zone_name: 'Bangsar', lat: 3.1312, lng: 101.6755, address: 'Bangsar Village Mall', fill_level_pct: 82, status: 'critical', urgency_score: 0.84, estimated_weight_kg: 41, waste_category: 'food_waste', waste_category_colour: '#f97316', predicted_full_at: new Date(Date.now() + 4 * 3600_000).toISOString(), battery_level_pct: 49, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 52 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-015', cluster_id: 'CLU-07', cluster_name: 'Bangsar Village', zone_id: 4, zone_name: 'Bangsar', lat: 3.1298, lng: 101.6770, address: 'Jln Maarof', fill_level_pct: 60, status: 'urgent', urgency_score: 0.58, estimated_weight_kg: 30, waste_category: 'plastic', waste_category_colour: '#3b82f6', predicted_full_at: new Date(Date.now() + 12 * 3600_000).toISOString(), battery_level_pct: 82, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 32 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-016', cluster_id: 'CLU-08', cluster_name: 'Bangsar South', zone_id: 4, zone_name: 'Bangsar', lat: 3.1280, lng: 101.6740, address: 'Bangsar South City', fill_level_pct: 38, status: 'monitor', urgency_score: 0.35, estimated_weight_kg: 19, waste_category: 'paper', waste_category_colour: '#eab308', predicted_full_at: null, battery_level_pct: 91, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 18 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-017', cluster_id: 'CLU-08', cluster_name: 'Bangsar South', zone_id: 4, zone_name: 'Bangsar', lat: 3.1265, lng: 101.6725, address: 'Jln Kerinchi', fill_level_pct: 12, status: 'normal', urgency_score: 0.10, estimated_weight_kg: 6, waste_category: 'general', waste_category_colour: '#6b7280', predicted_full_at: null, battery_level_pct: 96, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 6 * 3600_000).toISOString(), has_active_job: false },
  { bin_id: 'BIN-018', cluster_id: 'CLU-08', cluster_name: 'Bangsar South', zone_id: 4, zone_name: 'Bangsar', lat: 3.1290, lng: 101.6710, address: 'Jln Pantai Jaya', fill_level_pct: 50, status: 'monitor', urgency_score: 0.48, estimated_weight_kg: 25, waste_category: 'glass', waste_category_colour: '#22c55e', predicted_full_at: new Date(Date.now() + 20 * 3600_000).toISOString(), battery_level_pct: 75, last_reading_at: new Date().toISOString(), last_collected_at: new Date(Date.now() - 26 * 3600_000).toISOString(), has_active_job: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// MOCK VEHICLES
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_VEHICLES_REST: ActiveVehicle[] = [
  { vehicle_id: 'VEH-001', vehicle_type: 'lorry', driver_id: 'DRV-001', driver_name: 'Ahmad Razif', job_id: 'JOB-001', job_type: 'routine', zone_id: 1, state: 'collecting', current_lat: 3.1572, current_lng: 101.7134, last_seen_at: new Date().toISOString(), cargo_weight_kg: 820, cargo_limit_kg: 3000, cargo_utilisation_pct: 27.3, bins_collected: 3, bins_total: 8 },
  { vehicle_id: 'VEH-002', vehicle_type: 'lorry', driver_id: 'DRV-002', driver_name: 'Siti Norzila', job_id: 'JOB-002', job_type: 'emergency', zone_id: 2, state: 'en_route', current_lat: 3.1630, current_lng: 101.7010, last_seen_at: new Date().toISOString(), cargo_weight_kg: 1200, cargo_limit_kg: 3000, cargo_utilisation_pct: 40.0, bins_collected: 5, bins_total: 6 },
  { vehicle_id: 'VEH-003', vehicle_type: 'van', driver_id: 'DRV-003', driver_name: 'Ravi Kumar', job_id: 'JOB-003', job_type: 'routine', zone_id: 3, state: 'en_route', current_lat: 3.1348, current_lng: 101.6872, last_seen_at: new Date().toISOString(), cargo_weight_kg: 0, cargo_limit_kg: 1500, cargo_utilisation_pct: 0, bins_collected: 0, bins_total: 4 },
]

export const MOCK_VEHICLE_POSITIONS = [
  { vehicle_id: 'VEH-001', driver_id: 'DRV-001', lat: 3.1572, lng: 101.7134, speed_kmh: 18, heading_degrees: 45, job_id: 'JOB-001', zone_id: 1, current_cluster: 'CLU-01', next_cluster: 'CLU-02', bins_collected: 3, bins_total: 8, cargo_weight_kg: 820, cargo_limit_kg: 3000, cargo_utilisation_pct: 27.3 },
  { vehicle_id: 'VEH-002', driver_id: 'DRV-002', lat: 3.1630, lng: 101.7010, speed_kmh: 30, heading_degrees: 200, job_id: 'JOB-002', zone_id: 2, current_cluster: 'CLU-03', next_cluster: 'CLU-04', bins_collected: 5, bins_total: 6, cargo_weight_kg: 1200, cargo_limit_kg: 3000, cargo_utilisation_pct: 40.0 },
  { vehicle_id: 'VEH-003', driver_id: 'DRV-003', lat: 3.1348, lng: 101.6872, speed_kmh: 24, heading_degrees: 110, job_id: 'JOB-003', zone_id: 3, current_cluster: 'CLU-05', next_cluster: 'CLU-06', bins_collected: 0, bins_total: 4, cargo_weight_kg: 0, cargo_limit_kg: 1500, cargo_utilisation_pct: 0 },
]

// ─────────────────────────────────────────────────────────────────────────────
// MOCK JOBS
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_JOBS: CollectionJobListItem[] = [
  // Active
  { id: 'JOB-001', job_type: 'routine',   zone_id: 1, zone_name: 'KLCC',        state: 'IN_PROGRESS', priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-01', 'CLU-02'], planned_weight_kg: 200, actual_weight_kg: 82,  bins_total: 8, bins_collected: 3, bins_skipped: 0, created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), completed_at: null, duration_minutes: null },
  { id: 'JOB-002', job_type: 'emergency', zone_id: 2, zone_name: 'Chow Kit',    state: 'IN_PROGRESS', priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-03'],           planned_weight_kg: 100, actual_weight_kg: 120, bins_total: 6, bins_collected: 5, bins_skipped: 1, created_at: new Date(Date.now() - 1 * 3600_000).toISOString(), completed_at: null, duration_minutes: null },
  { id: 'JOB-003', job_type: 'routine',   zone_id: 3, zone_name: 'Brickfields', state: 'DISPATCHED',  priority: 3, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-05', 'CLU-06'], planned_weight_kg: 180, actual_weight_kg: null, bins_total: 4, bins_collected: 0, bins_skipped: 0, created_at: new Date(Date.now() - 30 * 60_000).toISOString(),  completed_at: null, duration_minutes: null },
  { id: 'JOB-009', job_type: 'routine',   zone_id: 4, zone_name: 'Bangsar',     state: 'DRIVER_NOTIFIED', priority: 2, assigned_vehicle_id: null, assigned_driver_id: 'DRV-004', clusters: ['CLU-07'], planned_weight_kg: 120, actual_weight_kg: null, bins_total: 3, bins_collected: 0, bins_skipped: 0, created_at: new Date(Date.now() - 10 * 60_000).toISOString(), completed_at: null, duration_minutes: null },
  // Terminal
  { id: 'JOB-004', job_type: 'routine',   zone_id: 4, zone_name: 'Bangsar',     state: 'COMPLETED',       priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-07', 'CLU-08'], planned_weight_kg: 160, actual_weight_kg: 155, bins_total: 5, bins_collected: 5, bins_skipped: 0, created_at: new Date(Date.now() - 8 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 5 * 3600_000).toISOString(), duration_minutes: 178 },
  { id: 'JOB-005', job_type: 'emergency', zone_id: 1, zone_name: 'KLCC',        state: 'FAILED',          priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-01'],           planned_weight_kg: 50,  actual_weight_kg: null, bins_total: 2, bins_collected: 0, bins_skipped: 2, created_at: new Date(Date.now() - 10 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 9 * 3600_000).toISOString(), duration_minutes: 30 },
  { id: 'JOB-006', job_type: 'routine',   zone_id: 2, zone_name: 'Chow Kit',    state: 'AUDIT_RECORDED',  priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-03', 'CLU-04'], planned_weight_kg: 220, actual_weight_kg: 208, bins_total: 7, bins_collected: 6, bins_skipped: 1, created_at: new Date(Date.now() - 26 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 23 * 3600_000).toISOString(), duration_minutes: 195 },
  { id: 'JOB-007', job_type: 'routine',   zone_id: 3, zone_name: 'Brickfields', state: 'COMPLETED',       priority: 2, assigned_vehicle_id: 'VEH-003', assigned_driver_id: 'DRV-003', clusters: ['CLU-05'],           planned_weight_kg: 90,  actual_weight_kg: 88,  bins_total: 3, bins_collected: 3, bins_skipped: 0, created_at: new Date(Date.now() - 30 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 28 * 3600_000).toISOString(), duration_minutes: 120 },
  { id: 'JOB-008', job_type: 'emergency', zone_id: 4, zone_name: 'Bangsar',     state: 'CANCELLED',       priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-07'],           planned_weight_kg: 70,  actual_weight_kg: null, bins_total: 2, bins_collected: 0, bins_skipped: 0, created_at: new Date(Date.now() - 36 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 35 * 3600_000).toISOString(), duration_minutes: 15 },
  { id: 'JOB-010', job_type: 'routine',   zone_id: 1, zone_name: 'KLCC',        state: 'COMPLETED',       priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-01', 'CLU-02'], planned_weight_kg: 190, actual_weight_kg: 184, bins_total: 6, bins_collected: 6, bins_skipped: 0, created_at: new Date(Date.now() - 50 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 47 * 3600_000).toISOString(), duration_minutes: 165 },
]

// Detail shape for the job detail drawer/page
const MOCK_JOB_DETAIL: Record<string, CollectionJobDetail> = {
  'JOB-001': {
    ...(MOCK_JOBS.find((j) => j.id === 'JOB-001')!),
    trigger_bin_id: null, trigger_urgency_score: null,
    route_plan_id: 'ROUTE-AA1', planned_distance_km: 4.8, actual_distance_km: 2.6,
    planned_duration_min: 90, hyperledger_tx_id: null, failure_reason: null, escalated_at: null,
    bin_collections: [
      { bin_id: 'BIN-001', cluster_id: 'CLU-01', sequence_number: 1, status: 'collected', collected_at: new Date(Date.now() - 100 * 60_000).toISOString(), fill_level_at_collection: 92, estimated_weight_kg: 46, actual_weight_kg: 45.2, skip_reason: null },
      { bin_id: 'BIN-003', cluster_id: 'CLU-02', sequence_number: 2, status: 'collected', collected_at: new Date(Date.now() - 60 * 60_000).toISOString(), fill_level_at_collection: 45, estimated_weight_kg: 22, actual_weight_kg: 21.0, skip_reason: null },
      { bin_id: 'BIN-004', cluster_id: 'CLU-02', sequence_number: 3, status: 'collected', collected_at: new Date(Date.now() - 20 * 60_000).toISOString(), fill_level_at_collection: 20, estimated_weight_kg: 10, actual_weight_kg: 9.8, skip_reason: null },
      { bin_id: 'BIN-002', cluster_id: 'CLU-01', sequence_number: 4, status: 'pending',   collected_at: null, fill_level_at_collection: null, estimated_weight_kg: 39, actual_weight_kg: null, skip_reason: null },
      { bin_id: 'BIN-005', cluster_id: 'CLU-02', sequence_number: 5, status: 'pending',   collected_at: null, fill_level_at_collection: null, estimated_weight_kg: 2,  actual_weight_kg: null, skip_reason: null },
    ],
    state_history: [
      { from_state: null,        to_state: 'CREATED',        reason: 'Routine schedule trigger', actor: 'system',           transitioned_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
      { from_state: 'CREATED',   to_state: 'BIN_CONFIRMED',  reason: null,                        actor: 'bin-status-svc',   transitioned_at: new Date(Date.now() - 118 * 60_000).toISOString() },
      { from_state: 'BIN_CONFIRMED', to_state: 'DISPATCHED', reason: null,                        actor: 'scheduler-svc',    transitioned_at: new Date(Date.now() - 110 * 60_000).toISOString() },
      { from_state: 'DISPATCHED',to_state: 'IN_PROGRESS',    reason: 'Driver accepted',           actor: 'driver:DRV-001',   transitioned_at: new Date(Date.now() - 105 * 60_000).toISOString() },
    ],
    step_log: [
      { step_name: 'bin_confirmation', attempt_number: 1, success: true, duration_ms: 240, executed_at: new Date(Date.now() - 118 * 60_000).toISOString() },
      { step_name: 'route_planning',   attempt_number: 1, success: true, duration_ms: 820, executed_at: new Date(Date.now() - 115 * 60_000).toISOString() },
    ],
  },
  'JOB-004': {
    ...(MOCK_JOBS.find((j) => j.id === 'JOB-004')!),
    trigger_bin_id: null, trigger_urgency_score: null,
    route_plan_id: 'ROUTE-BB4', planned_distance_km: 5.2, actual_distance_km: 5.5,
    planned_duration_min: 160, hyperledger_tx_id: 'HLF-0x8a3f9bc42d1e5...', failure_reason: null, escalated_at: null,
    bin_collections: [
      { bin_id: 'BIN-014', cluster_id: 'CLU-07', sequence_number: 1, status: 'collected', collected_at: new Date(Date.now() - 7 * 3600_000).toISOString(), fill_level_at_collection: 80, estimated_weight_kg: 40, actual_weight_kg: 40.5, skip_reason: null },
      { bin_id: 'BIN-015', cluster_id: 'CLU-07', sequence_number: 2, status: 'collected', collected_at: new Date(Date.now() - 6.5 * 3600_000).toISOString(), fill_level_at_collection: 58, estimated_weight_kg: 29, actual_weight_kg: 28.8, skip_reason: null },
      { bin_id: 'BIN-016', cluster_id: 'CLU-08', sequence_number: 3, status: 'collected', collected_at: new Date(Date.now() - 6 * 3600_000).toISOString(), fill_level_at_collection: 36, estimated_weight_kg: 18, actual_weight_kg: 17.9, skip_reason: null },
      { bin_id: 'BIN-017', cluster_id: 'CLU-08', sequence_number: 4, status: 'collected', collected_at: new Date(Date.now() - 5.5 * 3600_000).toISOString(), fill_level_at_collection: 10, estimated_weight_kg: 5,  actual_weight_kg: 5.1, skip_reason: null },
      { bin_id: 'BIN-018', cluster_id: 'CLU-08', sequence_number: 5, status: 'collected', collected_at: new Date(Date.now() - 5.2 * 3600_000).toISOString(), fill_level_at_collection: 48, estimated_weight_kg: 24, actual_weight_kg: 62.7, skip_reason: null },
    ],
    state_history: [
      { from_state: null, to_state: 'CREATED', reason: 'Routine schedule', actor: 'system', transitioned_at: new Date(Date.now() - 8 * 3600_000).toISOString() },
      { from_state: 'CREATED', to_state: 'IN_PROGRESS', reason: null, actor: 'orchestrator', transitioned_at: new Date(Date.now() - 7.8 * 3600_000).toISOString() },
      { from_state: 'IN_PROGRESS', to_state: 'COMPLETING', reason: 'All bins collected', actor: 'driver:DRV-001', transitioned_at: new Date(Date.now() - 5.1 * 3600_000).toISOString() },
      { from_state: 'COMPLETING', to_state: 'COMPLETED', reason: null, actor: 'orchestrator', transitioned_at: new Date(Date.now() - 5 * 3600_000).toISOString() },
    ],
    step_log: [],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE SUMMARIES
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_SUMMARIES: Record<number, ZoneSummary> = {
  1: { zone_id: 1, zone_name: 'KLCC',        total_bins: 5, total_clusters: 2, status_breakdown: { normal: 1, monitor: 1, urgent: 1, critical: 1, offline: 1 }, category_breakdown: { general: { total_bins: 2, avg_fill_pct: 48.5, total_weight_kg: 48,  urgent_count: 1 }, plastic: { total_bins: 1, avg_fill_pct: 78, total_weight_kg: 39, urgent_count: 1 }, food_waste: { total_bins: 1, avg_fill_pct: 45, total_weight_kg: 22, urgent_count: 0 }, paper: { total_bins: 1, avg_fill_pct: 20, total_weight_kg: 10, urgent_count: 0 } }, total_estimated_weight_kg: 119, active_jobs_count: 1, last_updated: new Date().toISOString() },
  2: { zone_id: 2, zone_name: 'Chow Kit',    total_bins: 4, total_clusters: 2, status_breakdown: { normal: 1, monitor: 1, urgent: 1, critical: 1, offline: 0 }, category_breakdown: { food_waste: { total_bins: 2, avg_fill_pct: 76.5, total_weight_kg: 76, urgent_count: 2 }, general: { total_bins: 1, avg_fill_pct: 33, total_weight_kg: 16, urgent_count: 0 }, plastic: { total_bins: 1, avg_fill_pct: 15, total_weight_kg: 7,  urgent_count: 0 } }, total_estimated_weight_kg: 99, active_jobs_count: 1, last_updated: new Date().toISOString() },
  3: { zone_id: 3, zone_name: 'Brickfields', total_bins: 4, total_clusters: 2, status_breakdown: { normal: 1, monitor: 2, urgent: 1, critical: 0, offline: 0 }, category_breakdown: { food_waste: { total_bins: 1, avg_fill_pct: 72, total_weight_kg: 36, urgent_count: 1 }, general: { total_bins: 1, avg_fill_pct: 55, total_weight_kg: 27, urgent_count: 0 }, glass: { total_bins: 1, avg_fill_pct: 25, total_weight_kg: 12, urgent_count: 0 }, e_waste: { total_bins: 1, avg_fill_pct: 40, total_weight_kg: 20, urgent_count: 0 } }, total_estimated_weight_kg: 95, active_jobs_count: 1, last_updated: new Date().toISOString() },
  4: { zone_id: 4, zone_name: 'Bangsar',     total_bins: 5, total_clusters: 2, status_breakdown: { normal: 1, monitor: 2, urgent: 1, critical: 1, offline: 0 }, category_breakdown: { food_waste: { total_bins: 1, avg_fill_pct: 82, total_weight_kg: 41, urgent_count: 1 }, plastic: { total_bins: 1, avg_fill_pct: 60, total_weight_kg: 30, urgent_count: 1 }, paper: { total_bins: 1, avg_fill_pct: 38, total_weight_kg: 19, urgent_count: 0 }, general: { total_bins: 1, avg_fill_pct: 12, total_weight_kg: 6,  urgent_count: 0 }, glass: { total_bins: 1, avg_fill_pct: 50, total_weight_kg: 25, urgent_count: 0 } }, total_estimated_weight_kg: 121, active_jobs_count: 0, last_updated: new Date().toISOString() },
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeBinHistory(binId: string): BinHistory {
  const now = Date.now()
  const seed = binId.charCodeAt(binId.length - 1) % 30
  const series = Array.from({ length: 24 }, (_, i) => ({
    timestamp:           new Date(now - (23 - i) * 3600_000).toISOString(),
    fill_level_pct:      Math.min(100, seed + i * 3.2 + Math.sin(i * 0.8) * 5),
    urgency_score:       Math.min(1, (seed + i * 3.2) / 100),
    estimated_weight_kg: Math.min(50, (seed + i * 3.2) * 0.5),
  }))
  return {
    bin_id: binId,
    from: new Date(now - 24 * 3600_000).toISOString(),
    to:   new Date(now).toISOString(),
    interval: '1h',
    series,
    collection_events: [
      { collected_at: new Date(now - 48 * 3600_000).toISOString(), fill_level_at_collection: 88 },
      { collected_at: new Date(now - 96 * 3600_000).toISOString(), fill_level_at_collection: 91 },
    ],
  }
}

// Generate 7-day fill trend time series per zone
function makeTrendsData(days: number, zoneFilter?: number) {
  const now = Date.now()
  const zones = zoneFilter ? [zoneFilter] : [1, 2, 3, 4]
  const BASE_FILLS: Record<number, number> = { 1: 52, 2: 48, 3: 44, 4: 56 }
  const series: Array<{ timestamp: string; zone_id: number; avg_fill_pct: number }> = []

  for (const zid of zones) {
    for (let d = days; d >= 0; d--) {
      for (let h = 0; h < 24; h += 4) {
        const base = BASE_FILLS[zid] ?? 50
        const val  = base + Math.sin((d * 24 + h) * 0.18) * 12 + Math.random() * 8 - 4
        series.push({
          timestamp:    new Date(now - d * 86_400_000 - h * 3_600_000).toISOString(),
          zone_id:      zid,
          avg_fill_pct: Math.max(0, Math.min(100, parseFloat(val.toFixed(1)))),
        })
      }
    }
  }
  return { series }
}

// 7-day waste generation forecast per category for a zone
function makeZoneForecast(zoneId: number) {
  const now = Date.now()
  const forecast = Array.from({ length: 7 }, (_, d) => {
    const date = new Date(now + d * 86_400_000).toISOString().slice(0, 10)
    const base = 40 + zoneId * 5
    return {
      date,
      general:    parseFloat((base + Math.random() * 10).toFixed(1)),
      organic:    parseFloat((base * 0.7 + Math.random() * 8).toFixed(1)),
      recyclable: parseFloat((base * 0.5 + Math.random() * 6).toFixed(1)),
      hazardous:  parseFloat((base * 0.1 + Math.random() * 3).toFixed(1)),
    }
  })
  return { zone_id: zoneId, forecast }
}

// Job performance stats
function makeJobStats(dateFrom: string, dateTo: string) {
  const from = new Date(dateFrom).getTime()
  const to   = new Date(dateTo).getTime()
  const days  = Math.max(1, Math.round((to - from) / 86_400_000))
  const daily = Array.from({ length: Math.min(days, 14) }, (_, i) => {
    const date = new Date(from + i * 86_400_000).toISOString().slice(0, 10)
    return {
      date,
      planned_km:  parseFloat((18 + Math.random() * 8).toFixed(1)),
      actual_km:   parseFloat((16 + Math.random() * 10).toFixed(1)),
      on_time_pct: parseFloat((78 + Math.random() * 18).toFixed(1)),
    }
  })
  const vehicles = MOCK_VEHICLES_REST.map((v) => ({
    vehicle_id:      v.vehicle_id,
    utilisation_pct: parseFloat((55 + Math.random() * 40).toFixed(1)),
  }))
  return { daily, vehicles }
}

// ─────────────────────────────────────────────────────────────────────────────
// MSW HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

export const handlers = [

  // ── Bins ────────────────────────────────────────────────────────────────────

  http.get(`${BASE}/api/v1/bins`, ({ request }) => {
    const url      = new URL(request.url)
    const zoneId   = url.searchParams.get('zone_id')
    const status   = url.searchParams.get('status')
    const category = url.searchParams.get('waste_category')
    const page     = parseInt(url.searchParams.get('page') ?? '1')
    const limit    = parseInt(url.searchParams.get('limit') ?? '25')

    let data = [...MOCK_BINS]
    if (zoneId)   data = data.filter((b) => b.zone_id === Number(zoneId))
    if (status)   data = data.filter((b) => b.status === status)
    if (category) data = data.filter((b) => b.waste_category === category)

    const total  = data.length
    const paged  = data.slice((page - 1) * limit, page * limit)
    return HttpResponse.json({ data: paged, total, page, limit })
  }),

  http.get(`${BASE}/api/v1/bins/:binId`, ({ params }) => {
    const bin = MOCK_BINS.find((b) => b.bin_id === params.binId)
    if (!bin) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...bin,
      recent_collections: [
        { job_id: 'JOB-004', collected_at: new Date(Date.now() - 5 * 3600_000).toISOString(),  driver_id: 'DRV-001', fill_level_at_collection: 87, actual_weight_kg: 43.5, job_type: 'routine' },
        { job_id: 'JOB-006', collected_at: new Date(Date.now() - 23 * 3600_000).toISOString(), driver_id: 'DRV-001', fill_level_at_collection: 74, actual_weight_kg: 37.2, job_type: 'routine' },
        { job_id: 'JOB-007', collected_at: new Date(Date.now() - 48 * 3600_000).toISOString(), driver_id: 'DRV-003', fill_level_at_collection: 91, actual_weight_kg: 45.6, job_type: 'emergency' },
      ],
    })
  }),

  http.get(`${BASE}/api/v1/bins/:binId/history`, ({ params }) => {
    return HttpResponse.json(makeBinHistory(params.binId as string))
  }),

  // ── Zones ───────────────────────────────────────────────────────────────────

  http.get(`${BASE}/api/v1/zones/:zoneId/summary`, ({ params }) => {
    const summary = ZONE_SUMMARIES[Number(params.zoneId)]
    if (!summary) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(summary)
  }),

  // ── Jobs ────────────────────────────────────────────────────────────────────

  // Must be declared before /:jobId to avoid the static "stats" segment matching as an ID
  http.get(`${BASE}/api/v1/collection-jobs/stats`, ({ request }) => {
    const url      = new URL(request.url)
    const dateFrom = url.searchParams.get('date_from') ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const dateTo   = url.searchParams.get('date_to')   ?? new Date().toISOString().slice(0, 10)
    return HttpResponse.json(makeJobStats(dateFrom, dateTo))
  }),

  http.get(`${BASE}/api/v1/collection-jobs`, ({ request }) => {
    const url    = new URL(request.url)
    const stateQ = url.searchParams.get('state')
    const states = stateQ ? stateQ.split(',') : null
    const limit  = parseInt(url.searchParams.get('limit') ?? '50')

    let data = [...MOCK_JOBS]
    if (states) data = data.filter((j) => states.includes(j.state))
    data = data.slice(0, limit)
    return HttpResponse.json({ data, total: data.length, page: 1 })
  }),

  http.get(`${BASE}/api/v1/collection-jobs/:jobId`, ({ params }) => {
    const detail = MOCK_JOB_DETAIL[params.jobId as string]
    if (detail) return HttpResponse.json(detail)
    // Fall back to list-item shape for jobs without a full detail mock
    const job = MOCK_JOBS.find((j) => j.id === params.jobId)
    if (!job) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({ ...job, trigger_bin_id: null, trigger_urgency_score: null, route_plan_id: null, planned_distance_km: null, actual_distance_km: null, planned_duration_min: null, hyperledger_tx_id: null, failure_reason: null, escalated_at: null, bin_collections: [], state_history: [], step_log: [] })
  }),

  http.post(`${BASE}/api/v1/collection-jobs/:jobId/cancel`, () => {
    return HttpResponse.json({ success: true })
  }),

  // ── Vehicles ────────────────────────────────────────────────────────────────

  http.get(`${BASE}/api/v1/vehicles/active`, () => {
    return HttpResponse.json({ vehicles: MOCK_VEHICLES_REST })
  }),

  // ── ML / Analytics ──────────────────────────────────────────────────────────

  http.get(`${BASE}/api/v1/ml/trends/waste-generation`, ({ request }) => {
    const url    = new URL(request.url)
    const days   = parseInt(url.searchParams.get('days') ?? '7')
    const zoneId = url.searchParams.get('zone_id') ? Number(url.searchParams.get('zone_id')) : undefined
    return HttpResponse.json(makeTrendsData(days, zoneId))
  }),

  http.get(`${BASE}/api/v1/ml/predict/fill-time`, ({ request }) => {
    const url   = new URL(request.url)
    const binId = url.searchParams.get('bin_id') ?? 'unknown'
    return HttpResponse.json({
      bin_id:           binId,
      predicted_full_at: new Date(Date.now() + 8 * 3600_000).toISOString(),
      confidence:       0.87,
      model_version:    'v2.1',
    })
  }),

  http.get(`${BASE}/api/v1/ml/predict/zone-generation`, ({ request }) => {
    const url    = new URL(request.url)
    const zoneId = Number(url.searchParams.get('zone_id') ?? '1')
    return HttpResponse.json(makeZoneForecast(zoneId))
  }),
]
