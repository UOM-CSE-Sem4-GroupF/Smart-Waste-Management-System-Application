'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { STATUS_COLORS } from '@/lib/colours'
import type { Cluster } from '@/types/cluster'

interface ClusterMarkerProps {
  map:     mapboxgl.Map
  cluster: Cluster
  onClick: (clusterId: string) => void
}

function getSize(totalWeightKg: number): number {
  if (totalWeightKg >= 2000) return 52
  if (totalWeightKg >= 500) return 44
  return 36
}

export function useClusterMarker({ map, cluster, onClick }: ClusterMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    const colour = STATUS_COLORS[cluster.cluster_status]
    const size = getSize(cluster.total_weight_kg)

    const el = document.createElement('div')
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid ${colour};
      background-color: ${colour}1A;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: transform 0.15s;
    `

    // Inner dot
    const dot = document.createElement('div')
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${colour};
    `
    el.appendChild(dot)

    // Urgent bins badge
    if (cluster.urgent_bins > 0) {
      const badge = document.createElement('div')
      badge.textContent = String(cluster.urgent_bins)
      badge.style.cssText = `
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: white;
        font-size: 10px;
        font-weight: bold;
        border-radius: 999px;
        padding: 0 4px;
        min-width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `
      el.appendChild(badge)
    }

    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.1)'
    })
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)'
    })
    el.addEventListener('click', () => onClick(cluster.cluster_id))

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: size / 2 + 4,
    }).setHTML(`
      <div style="font-size:12px;line-height:1.6;padding:4px 0;">
        <strong>${cluster.cluster_name}</strong><br/>
        Bins: ${cluster.bin_count}<br/>
        Weight: ${cluster.total_weight_kg.toFixed(1)} kg
      </div>
    `)

    el.addEventListener('mouseenter', () => popup.addTo(map))
    el.addEventListener('mouseleave', () => popup.remove())

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([cluster.lng, cluster.lat])
      .addTo(map)

    markerRef.current = marker

    return () => {
      popup.remove()
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cluster.cluster_id, cluster.cluster_status, cluster.urgent_bins, cluster.total_weight_kg])

  return markerRef
}
