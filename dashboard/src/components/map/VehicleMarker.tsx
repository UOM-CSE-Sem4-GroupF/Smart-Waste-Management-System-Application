'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { VehiclePositionPayload } from '@/types'

interface VehicleMarkerProps {
  map:     mapboxgl.Map
  vehicle: VehiclePositionPayload
  onSelect: (jobId: string) => void
}

function getContainerColour(pct: number): string {
  if (pct > 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#10b981'
}

export function useVehicleMarker({ map, vehicle, onSelect }: VehicleMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const prevPos = useRef<[number, number]>([vehicle.lng, vehicle.lat])
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const colour = getContainerColour(vehicle.cargo_utilisation_pct)

    const el = document.createElement('div')
    el.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background-color: ${colour};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `

    // Truck icon (SVG)
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    `

    el.addEventListener('click', () => {
      if (vehicle.job_id) onSelect(vehicle.job_id)
    })

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 20,
    }).setHTML(`
      <div style="font-size:12px;line-height:1.6;padding:4px 0;">
        <strong>${vehicle.vehicle_id}</strong><br/>
        Driver: ${vehicle.driver_id}<br/>
        Cargo: ${vehicle.cargo_utilisation_pct.toFixed(1)}%<br/>
        Bins: ${vehicle.bins_collected}/${vehicle.bins_total}
      </div>
    `)

    el.addEventListener('mouseenter', () => popup.addTo(map))
    el.addEventListener('mouseleave', () => popup.remove())

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([vehicle.lng, vehicle.lat])
      .addTo(map)

    markerRef.current = marker
    prevPos.current = [vehicle.lng, vehicle.lat]

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      popup.remove()
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, vehicle.vehicle_id])

  // Smooth position transition on lat/lng change
  useEffect(() => {
    if (!markerRef.current) return
    const [fromLng, fromLat] = prevPos.current
    const toLng = vehicle.lng
    const toLat = vehicle.lat
    const start = performance.now()
    const duration = 500

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    function animate(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const lng = fromLng + (toLng - fromLng) * t
      const lat = fromLat + (toLat - fromLat) * t
      markerRef.current?.setLngLat([lng, lat])
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevPos.current = [toLng, toLat]
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [vehicle.lat, vehicle.lng])

  return markerRef
}
