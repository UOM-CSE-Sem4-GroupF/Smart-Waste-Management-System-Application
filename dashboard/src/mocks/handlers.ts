import { http, HttpResponse } from 'msw'
import type { Bin, ZoneSummary, BinHistory } from '@/types'
import type { ActiveVehicle } from '@/types'
import type { CollectionJobListItem } from '@/types'

// ---------------------------------------------------------------------------
// Static mock data — exported so MockSocketInjector can use the same records
// ---------------------------------------------------------------------------

export const MOCK_BINS: Bin[] = []
export const MOCK_VEHICLES_REST: ActiveVehicle[] = []
export const MOCK_VEHICLE_POSITIONS: any[] = []
const MOCK_JOBS: CollectionJobListItem[] = []
const ZONE_SUMMARIES: Record<number, ZoneSummary> = {}

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

  // GET /api/v1/vehicles
  http.get('http://localhost:30080/api/v1/vehicles', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  // POST /api/v1/vehicles
  http.post('http://localhost:30080/api/v1/vehicles', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, vehicle_id: body.vehicle_id ?? `VEH-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/vehicles/:vehicleId
  http.patch('http://localhost:30080/api/v1/vehicles/:vehicleId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ vehicle_id: params.vehicleId, ...body })
  }),

  // GET /api/v1/drivers
  http.get('http://localhost:30080/api/v1/drivers', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  // POST /api/v1/drivers
  http.post('http://localhost:30080/api/v1/drivers', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...body, driver_id: `DRV-${Date.now()}` }, { status: 201 })
  }),

  // PATCH /api/v1/drivers/:driverId
  http.patch('http://localhost:30080/api/v1/drivers/:driverId', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ driver_id: params.driverId, ...body })
  }),

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
