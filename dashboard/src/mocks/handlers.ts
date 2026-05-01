import { http, HttpResponse } from 'msw'
import type { Bin, ZoneSummary, BinHistory } from '@/types'
import type { ActiveVehicle } from '@/types'
import type { CollectionJobListItem } from '@/types'

// ---------------------------------------------------------------------------
// Static mock data — exported so MockSocketInjector can use the same records
// ---------------------------------------------------------------------------

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

export const MOCK_VEHICLES_REST: ActiveVehicle[] = [
  { vehicle_id: 'VEH-001', vehicle_type: 'lorry', driver_id: 'DRV-001', driver_name: 'Ahmad Razif', job_id: 'JOB-001', job_type: 'routine', zone_id: 1, state: 'collecting', current_lat: 3.1572, current_lng: 101.7134, last_seen_at: new Date().toISOString(), cargo_weight_kg: 820, cargo_limit_kg: 3000, cargo_utilisation_pct: 27.3, bins_collected: 3, bins_total: 8 },
  { vehicle_id: 'VEH-002', vehicle_type: 'lorry', driver_id: 'DRV-002', driver_name: 'Siti Norzila', job_id: 'JOB-002', job_type: 'emergency', zone_id: 2, state: 'en_route', current_lat: 3.1630, current_lng: 101.7010, last_seen_at: new Date().toISOString(), cargo_weight_kg: 1200, cargo_limit_kg: 3000, cargo_utilisation_pct: 40.0, bins_collected: 5, bins_total: 6 },
]

// VehiclePositionPayload shape — used by MockSocketInjector
export const MOCK_VEHICLE_POSITIONS = [
  { vehicle_id: 'VEH-001', driver_id: 'DRV-001', lat: 3.1572, lng: 101.7134, speed_kmh: 18, heading_degrees: 45, job_id: 'JOB-001', zone_id: 1, current_cluster: 'CLU-01', next_cluster: 'CLU-02', bins_collected: 3, bins_total: 8, cargo_weight_kg: 820, cargo_limit_kg: 3000, cargo_utilisation_pct: 27.3 },
  { vehicle_id: 'VEH-002', driver_id: 'DRV-002', lat: 3.1630, lng: 101.7010, speed_kmh: 30, heading_degrees: 200, job_id: 'JOB-002', zone_id: 2, current_cluster: 'CLU-03', next_cluster: 'CLU-04', bins_collected: 5, bins_total: 6, cargo_weight_kg: 1200, cargo_limit_kg: 3000, cargo_utilisation_pct: 40.0 },
]

const MOCK_JOBS: CollectionJobListItem[] = [
  { id: 'JOB-001', job_type: 'routine', zone_id: 1, zone_name: 'KLCC', state: 'IN_PROGRESS', priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-01', 'CLU-02'], planned_weight_kg: 200, actual_weight_kg: 82, bins_total: 8, bins_collected: 3, bins_skipped: 0, created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), completed_at: null, duration_minutes: null },
  { id: 'JOB-002', job_type: 'emergency', zone_id: 2, zone_name: 'Chow Kit', state: 'IN_PROGRESS', priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-03'], planned_weight_kg: 100, actual_weight_kg: 120, bins_total: 6, bins_collected: 5, bins_skipped: 1, created_at: new Date(Date.now() - 1 * 3600_000).toISOString(), completed_at: null, duration_minutes: null },
  { id: 'JOB-003', job_type: 'routine', zone_id: 3, zone_name: 'Brickfields', state: 'DISPATCHED', priority: 3, assigned_vehicle_id: null, assigned_driver_id: null, clusters: ['CLU-05', 'CLU-06'], planned_weight_kg: 180, actual_weight_kg: null, bins_total: 4, bins_collected: 0, bins_skipped: 0, created_at: new Date(Date.now() - 30 * 60_000).toISOString(), completed_at: null, duration_minutes: null },
  { id: 'JOB-004', job_type: 'routine', zone_id: 4, zone_name: 'Bangsar', state: 'COMPLETED', priority: 2, assigned_vehicle_id: 'VEH-001', assigned_driver_id: 'DRV-001', clusters: ['CLU-07', 'CLU-08'], planned_weight_kg: 160, actual_weight_kg: 155, bins_total: 5, bins_collected: 5, bins_skipped: 0, created_at: new Date(Date.now() - 8 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 5 * 3600_000).toISOString(), duration_minutes: 178 },
  { id: 'JOB-005', job_type: 'emergency', zone_id: 1, zone_name: 'KLCC', state: 'FAILED', priority: 1, assigned_vehicle_id: 'VEH-002', assigned_driver_id: 'DRV-002', clusters: ['CLU-01'], planned_weight_kg: 50, actual_weight_kg: null, bins_total: 2, bins_collected: 0, bins_skipped: 2, created_at: new Date(Date.now() - 10 * 3600_000).toISOString(), completed_at: new Date(Date.now() - 9 * 3600_000).toISOString(), duration_minutes: 30 },
]

const ZONE_SUMMARIES: Record<number, ZoneSummary> = {
  1: { zone_id: 1, zone_name: 'KLCC', total_bins: 5, total_clusters: 2, status_breakdown: { normal: 1, monitor: 1, urgent: 1, critical: 1, offline: 1 }, category_breakdown: {}, total_estimated_weight_kg: 119, active_jobs_count: 1, last_updated: new Date().toISOString() },
  2: { zone_id: 2, zone_name: 'Chow Kit', total_bins: 4, total_clusters: 2, status_breakdown: { normal: 1, monitor: 1, urgent: 1, critical: 1, offline: 0 }, category_breakdown: {}, total_estimated_weight_kg: 99, active_jobs_count: 1, last_updated: new Date().toISOString() },
  3: { zone_id: 3, zone_name: 'Brickfields', total_bins: 4, total_clusters: 2, status_breakdown: { normal: 1, monitor: 2, urgent: 1, critical: 0, offline: 0 }, category_breakdown: {}, total_estimated_weight_kg: 95, active_jobs_count: 0, last_updated: new Date().toISOString() },
  4: { zone_id: 4, zone_name: 'Bangsar', total_bins: 5, total_clusters: 2, status_breakdown: { normal: 1, monitor: 2, urgent: 1, critical: 1, offline: 0 }, category_breakdown: {}, total_estimated_weight_kg: 121, active_jobs_count: 0, last_updated: new Date().toISOString() },
}

// ---------------------------------------------------------------------------
// Helper to generate bin history series
// ---------------------------------------------------------------------------
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
  // GET /api/v1/bins — supports ?zone_id= filter
  http.get('http://localhost:30080/api/v1/bins', ({ request }) => {
    const url = new URL(request.url)
    const zoneId = url.searchParams.get('zone_id')
    const data = zoneId
      ? MOCK_BINS.filter((b) => b.zone_id === Number(zoneId))
      : MOCK_BINS
    return HttpResponse.json({ data, total: data.length, page: 1, limit: 100 })
  }),

  // GET /api/v1/bins/:binId
  http.get('http://localhost:30080/api/v1/bins/:binId', ({ params }) => {
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
  http.get('http://localhost:30080/api/v1/bins/:binId/history', ({ params }) => {
    return HttpResponse.json(makeBinHistory(params.binId as string))
  }),

  // GET /api/v1/zones/:zoneId/summary
  http.get('http://localhost:30080/api/v1/zones/:zoneId/summary', ({ params }) => {
    const summary = ZONE_SUMMARIES[Number(params.zoneId)]
    if (!summary) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(summary)
  }),

  // GET /api/v1/collection-jobs — supports ?state= filter
  http.get('http://localhost:30080/api/v1/collection-jobs', ({ request }) => {
    const url = new URL(request.url)
    const state = url.searchParams.get('state')
    const data = state ? MOCK_JOBS.filter((j) => j.state === state) : MOCK_JOBS
    return HttpResponse.json({ data, total: data.length, page: 1 })
  }),

  // GET /api/v1/collection-jobs/:jobId
  http.get('http://localhost:30080/api/v1/collection-jobs/:jobId', ({ params }) => {
    const job = MOCK_JOBS.find((j) => j.id === params.jobId)
    if (!job) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(job)
  }),

  // GET /api/v1/vehicles/active
  http.get('http://localhost:30080/api/v1/vehicles/active', () => {
    return HttpResponse.json({ vehicles: MOCK_VEHICLES_REST })
  }),

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

  // GET /api/v1/ml/fill-time/:binId
  http.get('http://localhost:30080/api/v1/ml/fill-time/:binId', ({ params }) => {
    return HttpResponse.json({
      bin_id: params.binId,
      predicted_full_at: new Date(Date.now() + 8 * 3600_000).toISOString(),
      confidence: 0.87,
      model_version: 'v2.1',
    })
  }),
]
