'use client'
import { useEffect } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { MOCK_ZONE_STATS } from './handlers'

const IS_DEV = process.env.NODE_ENV === 'development'

export function MockSocketInjector() {
  const updateZoneStats = useMapStore((s) => s.updateZoneStats)
  const addAlert        = useAlertStore((s) => s.addAlert)

  // Seed zone stats once on mount
  useEffect(() => {
    if (!IS_DEV) return
    MOCK_ZONE_STATS.forEach((z) => updateZoneStats(z))
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

