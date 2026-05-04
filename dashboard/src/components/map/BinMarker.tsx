'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { STATUS_COLOURS } from '@/lib/mapbox'
import type { BinUpdatePayload } from '@/types/bin'

interface Props {
  map: mapboxgl.Map
  bin: BinUpdatePayload
  onSelect: (binId: string) => void
}

export function BinMarker({ map, bin, onSelect }: Props) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    const colour = STATUS_COLOURS[bin.status] ?? STATUS_COLOURS.offline
    const size = 12 + Math.round((bin.fill_level_pct / 100) * 10) // 12–22 px

    const el = document.createElement('div')
    el.className = 'bin-marker'
    el.style.cssText = `
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:${colour};
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      cursor:pointer;
    `

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onSelect(bin.bin_id)
    })

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([bin.lng ?? 0, bin.lat ?? 0])
      .addTo(map)

    markerRef.current = marker

    return () => {
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bin.bin_id])

  // Update position / colour when data changes without recreating
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    marker.setLngLat([bin.lng ?? 0, bin.lat ?? 0])

    const el = marker.getElement() as HTMLDivElement
    const colour = STATUS_COLOURS[bin.status] ?? STATUS_COLOURS.offline
    const size = 12 + Math.round((bin.fill_level_pct / 100) * 10)
    el.style.background = colour
    el.style.width = `${size}px`
    el.style.height = `${size}px`
  }, [bin.lat, bin.lng, bin.status, bin.fill_level_pct])

  return null
}
