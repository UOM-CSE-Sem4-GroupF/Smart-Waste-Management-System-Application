'use client'
import { useEffect, useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { useJobStore } from '@/store/jobStore'
import { MOCK_VEHICLE_POSITIONS, MOCK_ZONE_STATS, MOCK_JOBS } from './handlers'

const IS_DEV = process.env.NODE_ENV === 'development'

export function MockSocketInjector() {
  const setJobs         = useJobStore((s) => s.setJobs)
  const setJobsList     = useJobStore((s) => s.setJobsList)
  const updateVehicle   = useMapStore((s) => s.updateVehicle)
  const updateZoneStats = useMapStore((s) => s.updateZoneStats)
  const addAlert        = useAlertStore((s) => s.addAlert)

  // Track mutable vehicle positions between ticks without causing re-renders
  const vehicleOffsets = useRef(MOCK_VEHICLE_POSITIONS.map((v) => ({ lat: v.lat, lng: v.lng })))

  // Seed vehicles and zone stats once on mount
  // (bin seeding removed — map now uses real bin data fetched from bin-status service)
  useEffect(() => {
    if (!IS_DEV) return
    // MOCK_BINS seed unwired — keep data in handlers.ts for reference
    MOCK_VEHICLE_POSITIONS.forEach((v) => updateVehicle(v))
    MOCK_ZONE_STATS.forEach((z) => updateZoneStats(z))
    // Seed job store — maps CollectionJobListItem → CollectionJob shape (for analytics charts)
    setJobs(MOCK_JOBS.map((j) => ({
      job_id:            j.id,
      job_type:          j.job_type,
      zone_id:           j.zone_id,
      zone_name:         j.zone_name,
      clusters:          j.clusters,
      vehicle_id:        j.assigned_vehicle_id ?? '',
      driver_id:         j.assigned_driver_id,
      total_bins:        j.bins_total,
      planned_weight_kg: j.planned_weight_kg ?? 0,
      priority:          j.priority,
      route:             [],
      state:             j.state,
      bins_collected:    j.bins_collected,
      bins_skipped:      j.bins_skipped,
      actual_weight_kg:  j.actual_weight_kg ?? undefined,
      duration_minutes:  j.duration_minutes ?? undefined,
    })))
    // Also seed the flat list used by the jobs page as fallback
    setJobsList(MOCK_JOBS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!IS_DEV) return
    // Bin fill-level interval unwired — real updates come via socket bin:update events

    // --- Vehicle position updates every 5 s ---
    const vehicleInterval = setInterval(() => {
      MOCK_VEHICLE_POSITIONS.forEach((v, i) => {
        // Small random walk
        vehicleOffsets.current[i].lat += (Math.random() - 0.5) * 0.0008
        vehicleOffsets.current[i].lng += (Math.random() - 0.5) * 0.0008

        updateVehicle({
          ...v,
          lat: vehicleOffsets.current[i].lat,
          lng: vehicleOffsets.current[i].lng,
          speed_kmh: Math.round(Math.random() * 35 + 5),
          heading_degrees: Math.round(Math.random() * 360),
        })
      })
    }, 5_000)

    // --- Random alerts every 30 s ---
    const MOCK_ZONE_IDS = [1, 2, 3]
    const alertInterval = setInterval(() => {
      const types = ['urgent', 'escalated', 'deviation'] as const
      const type   = types[Math.floor(Math.random() * types.length)]
      const zone_id = MOCK_ZONE_IDS[Math.floor(Math.random() * MOCK_ZONE_IDS.length)]

      addAlert({
        type,
        zone_id,
        message:
          type === 'urgent'    ? `Urgent bin detected in zone ${zone_id}` :
          type === 'escalated' ? `Zone ${zone_id} escalated — no collection in 48 h` :
          `Vehicle deviated from planned route in zone ${zone_id}`,
      })
    }, 30_000)

    return () => {
      clearInterval(vehicleInterval)
      clearInterval(alertInterval)
    }
  }, [updateVehicle, addAlert])

  return null
}
