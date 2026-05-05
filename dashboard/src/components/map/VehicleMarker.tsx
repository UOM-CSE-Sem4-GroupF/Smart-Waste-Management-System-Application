'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { VEHICLE_ROUTE_COLOURS, DEFAULT_ROUTE_COLOUR } from '@/lib/mapbox'
import type { VehiclePositionPayload } from '@/types/vehicle'

interface Props {
  map: mapboxgl.Map
  vehicle: VehiclePositionPayload
}

export function VehicleMarker({ map, vehicle }: Props) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    const colour =
      VEHICLE_ROUTE_COLOURS[vehicle.vehicle_id] ?? DEFAULT_ROUTE_COLOUR

    const el = document.createElement('div')
    el.className = 'vehicle-marker'
    el.style.cssText = `
      width:32px;
      height:32px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:22px;
      line-height:1;
      filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));
      transform-origin:center;
      transition:transform 500ms ease;
      cursor:default;
    `
    el.innerHTML = '🚛'
    el.style.transform = `rotate(${vehicle.heading_degrees ?? 0}deg)`

    // Tooltip
    const popup = new mapboxgl.Popup({
      closeButton: false,
      offset: 20,
    }).setHTML(`
      <div style="font-size:12px;font-family:sans-serif;line-height:1.5">
        <strong>${vehicle.vehicle_id}</strong><br/>
        Driver: ${vehicle.driver_id ?? '—'}<br/>
        Cargo: ${vehicle.cargo_weight_kg ?? 0} / ${vehicle.cargo_limit_kg ?? 0} kg
      </div>
    `)

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([vehicle.lng, vehicle.lat])
      .setPopup(popup)
      .addTo(map)

    el.style.color = colour
    markerRef.current = marker

    return () => {
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, vehicle.vehicle_id])

  // Smooth position + heading update
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    marker.setLngLat([vehicle.lng, vehicle.lat])
    const el = marker.getElement() as HTMLDivElement
    el.style.transform = `rotate(${vehicle.heading_degrees ?? 0}deg)`
  }, [vehicle.lat, vehicle.lng, vehicle.heading_degrees])

  return null
}
