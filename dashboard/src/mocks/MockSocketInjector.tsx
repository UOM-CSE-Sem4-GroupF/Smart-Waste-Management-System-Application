'use client'
import { useEffect, useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { useJobStore } from '@/store/jobStore'
import { MOCK_BINS, MOCK_VEHICLE_POSITIONS, MOCK_JOBS } from './handlers'
import type { ZoneStatsPayload } from '@/types'

// ── Seed zone stats from mock job + bin data ─────────────────────────────────

const ZONE_STATS: ZoneStatsPayload[] = [
  {
    zone_id: 1, zone_name: 'KLCC',
    avg_fill_level_pct: 48.0, urgent_bin_count: 1, critical_bin_count: 1,
    total_bins: 5, total_estimated_weight_kg: 119, dominant_waste_category: 'general',
    category_breakdown: {
      general:    { count: 2, avg_fill: 48.5, total_kg: 48 },
      plastic:    { count: 1, avg_fill: 78.0, total_kg: 39 },
      food_waste: { count: 1, avg_fill: 45.0, total_kg: 22 },
      paper:      { count: 1, avg_fill: 20.0, total_kg: 10 },
    },
    active_jobs_count: 1, unassigned_urgent_bins: 0,
  },
  {
    zone_id: 2, zone_name: 'Chow Kit',
    avg_fill_level_pct: 51.5, urgent_bin_count: 1, critical_bin_count: 1,
    total_bins: 4, total_estimated_weight_kg: 99,  dominant_waste_category: 'food_waste',
    category_breakdown: {
      food_waste: { count: 2, avg_fill: 76.5, total_kg: 76 },
      general:    { count: 1, avg_fill: 33.0, total_kg: 16 },
      plastic:    { count: 1, avg_fill: 15.0, total_kg: 7  },
    },
    active_jobs_count: 1, unassigned_urgent_bins: 1,
  },
  {
    zone_id: 3, zone_name: 'Brickfields',
    avg_fill_level_pct: 48.0, urgent_bin_count: 1, critical_bin_count: 0,
    total_bins: 4, total_estimated_weight_kg: 95,  dominant_waste_category: 'food_waste',
    category_breakdown: {
      food_waste: { count: 1, avg_fill: 72.0, total_kg: 36 },
      general:    { count: 1, avg_fill: 55.0, total_kg: 27 },
      glass:      { count: 1, avg_fill: 25.0, total_kg: 12 },
      e_waste:    { count: 1, avg_fill: 40.0, total_kg: 20 },
    },
    active_jobs_count: 1, unassigned_urgent_bins: 0,
  },
  {
    zone_id: 4, zone_name: 'Bangsar',
    avg_fill_level_pct: 48.4, urgent_bin_count: 1, critical_bin_count: 1,
    total_bins: 5, total_estimated_weight_kg: 121, dominant_waste_category: 'food_waste',
    category_breakdown: {
      food_waste: { count: 1, avg_fill: 82.0, total_kg: 41 },
      plastic:    { count: 1, avg_fill: 60.0, total_kg: 30 },
      paper:      { count: 1, avg_fill: 38.0, total_kg: 19 },
      general:    { count: 1, avg_fill: 12.0, total_kg: 6  },
      glass:      { count: 1, avg_fill: 50.0, total_kg: 25 },
    },
    active_jobs_count: 0, unassigned_urgent_bins: 1,
  },
]

export function MockSocketInjector() {
  const updateBin      = useMapStore((s) => s.updateBin)
  const updateVehicle  = useMapStore((s) => s.updateVehicle)
  const updateZone     = useMapStore((s) => s.updateZoneStats)
  const setBins        = useMapStore((s) => s.setBins)
  const addAlert       = useAlertStore((s) => s.addAlert)
  const setJobsFromList = useJobStore((s) => s.setJobsFromList)

  const vehicleOffsets = useRef(MOCK_VEHICLE_POSITIONS.map((v) => ({ lat: v.lat, lng: v.lng })))
  const binFills = useRef(MOCK_BINS.map((b) => b.fill_level_pct))

  useEffect(() => {
    // ── Seed initial state immediately ──────────────────────────────────────
    // Populate bins, zones, and jobs into stores so pages don't start empty
    setBins(
      MOCK_BINS.map((b) => ({
        bin_id:                b.bin_id,
        cluster_id:            b.cluster_id,
        cluster_name:          b.cluster_name,
        zone_id:               b.zone_id,
        fill_level_pct:        b.fill_level_pct,
        status:                b.status,
        urgency_score:         b.urgency_score,
        estimated_weight_kg:   b.estimated_weight_kg,
        waste_category:        b.waste_category,
        waste_category_colour: b.waste_category_colour,
        fill_rate_pct_per_hour: 1.2,
        predicted_full_at:     b.predicted_full_at,
        battery_level_pct:     b.battery_level_pct,
        has_active_job:        b.has_active_job,
        collection_triggered:  false,
        last_collected_at:     b.last_collected_at,
        lat:                   b.lat,
        lng:                   b.lng,
      })),
    )

    ZONE_STATS.forEach((z) => updateZone(z))

    setJobsFromList(MOCK_JOBS)

    // Seed one initial alert so the bell/banner shows immediately
    addAlert({
      type:    'urgent',
      bin_id:  'BIN-001',
      zone_id: 1,
      message: 'BIN-001 at 92% fill — collection overdue by 48 h',
    })
    addAlert({
      type:    'escalated',
      bin_id:  'BIN-006',
      zone_id: 2,
      message: 'BIN-006 escalated — no driver response after 3 retries',
    })

    // ── Bin fill-level drift every 8 s ──────────────────────────────────────
    const binInterval = setInterval(() => {
      const idx  = Math.floor(Math.random() * MOCK_BINS.length)
      const bin  = MOCK_BINS[idx]
      const delta = (Math.random() - 0.15) * 3
      const fill  = Math.min(100, Math.max(0, binFills.current[idx] + delta))
      binFills.current[idx] = fill

      const status =
        fill >= 90 ? 'critical' :
        fill >= 75 ? 'urgent'   :
        fill >= 50 ? 'monitor'  :
        bin.status === 'offline' ? 'offline' : 'normal'

      updateBin({
        bin_id:                bin.bin_id,
        cluster_id:            bin.cluster_id,
        cluster_name:          bin.cluster_name,
        zone_id:               bin.zone_id,
        fill_level_pct:        parseFloat(fill.toFixed(1)),
        status,
        urgency_score:         parseFloat((fill / 100).toFixed(2)),
        estimated_weight_kg:   parseFloat((fill * 0.5).toFixed(1)),
        waste_category:        bin.waste_category,
        waste_category_colour: bin.waste_category_colour,
        fill_rate_pct_per_hour: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
        predicted_full_at:     fill > 60
          ? new Date(Date.now() + ((100 - fill) / 3) * 3600_000).toISOString()
          : null,
        battery_level_pct:     bin.battery_level_pct,
        has_active_job:        bin.has_active_job,
        collection_triggered:  fill >= 90,
        last_collected_at:     bin.last_collected_at,
        lat:                   bin.lat,
        lng:                   bin.lng,
      })
    }, 8_000)

    // ── Vehicle position random walk every 5 s ──────────────────────────────
    const vehicleInterval = setInterval(() => {
      MOCK_VEHICLE_POSITIONS.forEach((v, i) => {
        vehicleOffsets.current[i].lat += (Math.random() - 0.5) * 0.0006
        vehicleOffsets.current[i].lng += (Math.random() - 0.5) * 0.0006
        updateVehicle({
          ...v,
          lat:             vehicleOffsets.current[i].lat,
          lng:             vehicleOffsets.current[i].lng,
          speed_kmh:       Math.round(Math.random() * 35 + 5),
          heading_degrees: Math.round(Math.random() * 360),
        })
      })
    }, 5_000)

    // ── Zone stats refresh every 20 s ───────────────────────────────────────
    const zoneInterval = setInterval(() => {
      ZONE_STATS.forEach((z) => {
        updateZone({
          ...z,
          avg_fill_level_pct: parseFloat(
            Math.max(0, Math.min(100, z.avg_fill_level_pct + (Math.random() - 0.5) * 2)).toFixed(1),
          ),
        })
      })
    }, 20_000)

    // ── Random alerts every 45 s ────────────────────────────────────────────
    const alertInterval = setInterval(() => {
      const types = ['urgent', 'escalated', 'deviation'] as const
      const type  = types[Math.floor(Math.random() * types.length)]
      const bin   = MOCK_BINS[Math.floor(Math.random() * MOCK_BINS.length)]
      addAlert({
        type,
        bin_id:  bin.bin_id,
        zone_id: bin.zone_id,
        message:
          type === 'urgent'    ? `${bin.bin_id} reached critical fill level (${bin.fill_level_pct}%)` :
          type === 'escalated' ? `${bin.bin_id} escalated — no collection after 48 h` :
                                 `Vehicle VEH-001 deviated from planned route in ${bin.zone_name}`,
      })
    }, 45_000)

    return () => {
      clearInterval(binInterval)
      clearInterval(vehicleInterval)
      clearInterval(zoneInterval)
      clearInterval(alertInterval)
    }
  // Zustand actions are stable references — omitting them from deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
