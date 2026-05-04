'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { STATUS_COLOURS } from '@/lib/mapbox'
import type { Cluster } from '@/types/cluster'

interface Props {
  map: mapboxgl.Map
  cluster: Cluster
  onSelect: (clusterId: string) => void
}

export function ClusterMarker({ map, cluster, onSelect }: Props) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    const status = cluster.cluster_status ?? 'normal'
    const colour = STATUS_COLOURS[status] ?? STATUS_COLOURS.offline

    // Size proportional to number of bins (clamp 28–56 px)
    const size = Math.min(56, Math.max(28, 28 + (cluster.bin_count ?? 0) * 2))

    const el = document.createElement('div')
    el.className = 'cluster-marker'
    el.style.cssText = `
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:${colour};
      border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:11px;
      font-weight:700;
      font-family:sans-serif;
    `
    el.textContent = String(cluster.bin_count ?? 0)

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onSelect(cluster.cluster_id)
    })

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([cluster.lng, cluster.lat])
      .addTo(map)

    markerRef.current = marker

    return () => {
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cluster.cluster_id])

  // Update when data changes
  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    marker.setLngLat([cluster.lng, cluster.lat])

    const el = marker.getElement() as HTMLDivElement
    const status = cluster.cluster_status ?? 'normal'
    el.style.background = STATUS_COLOURS[status] ?? STATUS_COLOURS.offline
    el.textContent = String(cluster.bin_count ?? 0)
  }, [cluster.lat, cluster.lng, cluster.cluster_status, cluster.bin_count])

  return null
}
