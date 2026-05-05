'use client'
import { useEffect, useRef } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { MOCK_BINS, MOCK_VEHICLE_POSITIONS } from './handlers'

const IS_DEV = process.env.NODE_ENV === 'development'

export function MockSocketInjector() {
  const updateBin     = useMapStore((s) => s.updateBin)
  const updateVehicle = useMapStore((s) => s.updateVehicle)
  const addAlert      = useAlertStore((s) => s.addAlert)

  // Track mutable vehicle positions between ticks without causing re-renders
  const vehicleOffsets = useRef(MOCK_VEHICLE_POSITIONS.map((v) => ({ lat: v.lat, lng: v.lng })))

  useEffect(() => {
    if (!IS_DEV) return
    // --- Bin fill-level updates every 8 s ---
    const binInterval = setInterval(() => {
      const bin = MOCK_BINS[Math.floor(Math.random() * MOCK_BINS.length)]
      const delta = (Math.random() - 0.15) * 4 // mostly increases
      const newFill = Math.min(100, Math.max(0, bin.fill_level_pct + delta))
      const newStatus =
        newFill >= 90 ? 'critical' :
        newFill >= 75 ? 'urgent' :
        newFill >= 50 ? 'monitor' :
        bin.status === 'offline' ? 'offline' : 'normal'

      updateBin({
        bin_id: bin.bin_id,
        cluster_id: bin.cluster_id,
        cluster_name: bin.cluster_name,
        zone_id: bin.zone_id,
        fill_level_pct: Math.round(newFill),
        status: newStatus,
        urgency_score: parseFloat((newFill / 100).toFixed(2)),
        estimated_weight_kg: parseFloat((newFill * 0.5).toFixed(1)),
        waste_category: bin.waste_category,
        waste_category_colour: bin.waste_category_colour,
        fill_rate_pct_per_hour: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
        predicted_full_at: newFill > 60
          ? new Date(Date.now() + ((100 - newFill) / 3) * 3600_000).toISOString()
          : null,
        battery_level_pct: bin.battery_level_pct,
        has_active_job: bin.has_active_job,
        collection_triggered: newFill >= 90,
        last_collected_at: bin.last_collected_at,
        lat: bin.lat,
        lng: bin.lng,
      })
    }, 8_000)

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
    const alertInterval = setInterval(() => {
      const types = ['urgent', 'escalated', 'deviation'] as const
      const type = types[Math.floor(Math.random() * types.length)]
      const bin = MOCK_BINS[Math.floor(Math.random() * MOCK_BINS.length)]

      addAlert({
        type,
        bin_id:  bin.bin_id,
        zone_id: bin.zone_id,
        message:
          type === 'urgent'    ? `Bin ${bin.bin_id} is at critical fill level (${bin.fill_level_pct}%)` :
          type === 'escalated' ? `Bin ${bin.bin_id} escalated — no collection in 48 h` :
                                 `Vehicle VEH-001 deviated from planned route`,
      })
    }, 30_000)

    return () => {
      clearInterval(binInterval)
      clearInterval(vehicleInterval)
      clearInterval(alertInterval)
    }
  }, [updateBin, updateVehicle, addAlert])

  return null
}
