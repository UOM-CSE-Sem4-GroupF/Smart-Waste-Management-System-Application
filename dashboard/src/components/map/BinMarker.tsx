'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { STATUS_COLORS } from '@/lib/colours'
import type { BinUpdatePayload } from '@/types'

interface BinMarkerProps {
  map:      mapboxgl.Map
  bin:      BinUpdatePayload
  onSelect: (binId: string) => void
}

export function useBinMarker({ map, bin, onSelect }: BinMarkerProps) {
  const markerRef  = useRef<mapboxgl.Marker | null>(null)
  const elRef      = useRef<HTMLDivElement | null>(null)
  const popupRef   = useRef<mapboxgl.Popup | null>(null)
  // Stable ref so click handler never stales without triggering marker recreation
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // ── Effect 1: create / destroy marker — only when position changes ──────────
  useEffect(() => {
    if (!bin.lat || !bin.lng) return

    const colour  = STATUS_COLORS[bin.status] ?? '#6b7280'
    const isPulse = bin.status === 'urgent' || bin.status === 'critical'

    const el = document.createElement('div')
    el.className = 'bin-marker'
    el.style.cssText = `
      width: 12px; height: 12px; border-radius: 50%;
      background-color: ${colour};
      border: 1.5px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: width 0.15s, height 0.15s;
    `
    if (isPulse) el.style.animation = 'bin-pulse 1.5s ease-in-out infinite'

    el.addEventListener('mouseenter', () => { el.style.width = '16px'; el.style.height = '16px' })
    el.addEventListener('mouseleave', () => { el.style.width = '12px'; el.style.height = '12px' })
    el.addEventListener('click', () => onSelectRef.current(bin.bin_id))

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      .setHTML(popupHtml(bin))

    el.addEventListener('mouseenter', () => popup.addTo(map))
    el.addEventListener('mouseleave', () => popup.remove())

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([bin.lng, bin.lat])
      .addTo(map)

    markerRef.current = marker
    elRef.current     = el
    popupRef.current  = popup

    return () => {
      popup.remove()
      marker.remove()
      markerRef.current = null
      elRef.current     = null
      popupRef.current  = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bin.bin_id, bin.lat, bin.lng])

  // ── Effect 2: update dot colour in-place when status changes ────────────────
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const colour  = STATUS_COLORS[bin.status] ?? '#6b7280'
    const isPulse = bin.status === 'urgent' || bin.status === 'critical'
    el.style.backgroundColor = colour
    el.style.animation = isPulse ? 'bin-pulse 1.5s ease-in-out infinite' : ''
  }, [bin.status])

  // ── Effect 3: refresh popup text when fill / status changes ─────────────────
  useEffect(() => {
    popupRef.current?.setHTML(popupHtml(bin))
  }, [bin.bin_id, bin.fill_level_pct, bin.status])

  return markerRef
}

function popupHtml(bin: BinUpdatePayload): string {
  return `<div style="font-size:12px;line-height:1.6;padding:4px 0;">
    <strong>${bin.bin_id}</strong><br/>
    Fill: ${bin.fill_level_pct ?? '—'}%<br/>
    Status: ${bin.status ?? '—'}
  </div>`
}
