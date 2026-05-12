'use client'
import { useEffect, useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { useJobStore } from '@/store/jobStore'
import { MOCK_ZONE_STATS, MOCK_JOBS } from './handlers'

const IS_DEV = process.env.NODE_ENV === 'development'

export function MockSocketInjector() {
  const setJobs         = useJobStore((s) => s.setJobs)
  const setJobsList     = useJobStore((s) => s.setJobsList)
  const updateZoneStats = useMapStore((s) => s.updateZoneStats)
  const addAlert        = useAlertStore((s) => s.addAlert)

  // Seed zone stats and jobs once on mount
  useEffect(() => {
    if (!IS_DEV) return
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
      clearInterval(alertInterval)
    }
  }, [addAlert])

  return null
}

