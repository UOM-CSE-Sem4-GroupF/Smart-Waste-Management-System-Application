import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('http://localhost:30080/api/v1/bins', () => {
    return HttpResponse.json({
      data: [
        {
          bin_id: 'BIN-001',
          cluster_id: 'CL-01',
          cluster_name: 'Cluster 1',
          zone_id: 1,
          zone_name: 'Zone 1',
          lat: 3.1390,
          lng: 101.6869,
          address: '123 Main St',
          fill_level_pct: 85,
          status: 'urgent',
          urgency_score: 88,
          estimated_weight_kg: 18.4,
          waste_category: 'food_waste',
          waste_category_colour: '#8B4513',
          predicted_full_at: null,
          battery_level_pct: 72,
          last_reading_at: new Date().toISOString(),
          last_collected_at: null,
          has_active_job: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    })
  }),

  http.get('http://localhost:30080/api/v1/collection-jobs', () => {
    return HttpResponse.json({ data: [], total: 0, page: 1 })
  }),

  http.get('http://localhost:30080/api/v1/vehicles/active', () => {
    return HttpResponse.json({ vehicles: [] })
  }),

  http.get('http://localhost:30080/api/v1/zones/:zoneId/summary', ({ params }) => {
    return HttpResponse.json({
      zone_id: Number(params.zoneId),
      zone_name: `Zone ${params.zoneId}`,
      total_bins: 10,
      total_clusters: 3,
      status_breakdown: { normal: 7, monitor: 1, urgent: 1, critical: 1, offline: 0 },
      category_breakdown: {},
      total_estimated_weight_kg: 150,
      active_jobs_count: 0,
      last_updated: new Date().toISOString(),
    })
  }),
]
