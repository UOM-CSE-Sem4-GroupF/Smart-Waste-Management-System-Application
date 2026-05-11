'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { STATUS_COLORS } from '@/lib/colours'
import type { BinUpdatePayload } from '@/types'

interface BinMarkerProps {
  map:    mapboxgl.Map
  bin:    BinUpdatePayload
  onSelect: (binId: string) => void
}

export function useBinMarker({ map, bin, onSelect }: BinMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!bin.lat || !bin.lng) return

    const colour = STATUS_COLORS[bin.status] ?? '#6b7280'
    const isPulse = bin.status === 'urgent' || bin.status === 'critical'

    const el = document.createElement('div')
    el.className = 'bin-marker'
    el.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: ${colour};
      border: 1.5px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: width 0.15s, height 0.15s;
    `
    if (isPulse) {
      el.style.animation = 'bin-pulse 1.5s ease-in-out infinite'
    }

    el.addEventListener('mouseenter', () => {
      el.style.width = '16px'
      el.style.height = '16px'
    })
    el.addEventListener('mouseleave', () => {
      el.style.width = '12px'
      el.style.height = '12px'
    })
    el.addEventListener('click', () => onSelect(bin.bin_id))

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    }).setHTML(`
      <div style="font-size:12px;line-height:1.4;padding:4px 0;">
        <strong>${bin.bin_id}</strong><br/>
        Fill: ${bin.fill_level_pct}%<br/>
        Status: ${bin.status}
      </div>
    `)

    el.addEventListener('mouseenter', () => popup.addTo(map))
    el.addEventListener('mouseleave', () => popup.remove())

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([bin.lng!, bin.lat!])
      .addTo(map)

    markerRef.current = marker

    return () => {
      popup.remove()
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bin.bin_id, bin.lat, bin.lng, bin.status, bin.fill_level_pct])

  return markerRef
}
