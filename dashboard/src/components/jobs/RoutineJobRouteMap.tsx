'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEPOT_LAT, DEPOT_LNG } from '@/lib/mapbox'
import type { CoreCluster } from '@/lib/api/metadata'

interface RouteStats {
  distanceKm: number
  durationMin: number
}

function makeDepotMarkerEl() {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:30px', 'height:30px', 'border-radius:50%',
    'background:#6366f1',
    'color:white', 'display:flex', 'align-items:center', 'justify-content:center',
    'border:2.5px solid white', 'box-shadow:0 1px 4px rgba(0,0,0,0.35)', 'cursor:pointer',
  ].join(';')
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`
  return el
}

async function fetchOsrmRoute(
  stops: { lat: number; lng: number }[],
): Promise<{ coords: [number, number][]; distanceKm: number; durationMin: number }> {
  const fallback = { coords: stops.map(s => [s.lng, s.lat] as [number, number]), distanceKm: 0, durationMin: 0 }
  if (stops.length < 2) return fallback
  try {
    const coordStr = stops.map(s => `${s.lng},${s.lat}`).join(';')
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return fallback
    const data = await res.json() as {
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: { coordinates?: [number, number][] }
      }>
    }
    const route = data.routes?.[0]
    return {
      coords:      route?.geometry?.coordinates ?? fallback.coords,
      distanceKm:  (route?.distance ?? 0) / 1000,
      durationMin: Math.round((route?.duration ?? 0) / 60),
    }
  } catch {
    return fallback
  }
}

interface Props {
  clusters:  CoreCluster[]
  className?: string
}

export function RoutineJobRouteMap({ clusters, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const [stats, setStats] = useState<RouteStats | null>(null)

  const valid = clusters.filter(
    c => c.lat != null && c.lng != null &&
         Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)),
  )

  useEffect(() => {
    if (!containerRef.current) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    setStats(null)

    if (valid.length === 0) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    [Number(valid[0].lng), Number(valid[0].lat)],
      zoom:      12,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', async () => {
      // Depot → all clusters → back to depot (round-trip)
      const stops = [
        { lat: DEPOT_LAT, lng: DEPOT_LNG },
        ...valid.map(c => ({ lat: Number(c.lat), lng: Number(c.lng) })),
        { lat: DEPOT_LAT, lng: DEPOT_LNG },
      ]

      const { coords, distanceKm, durationMin } = await fetchOsrmRoute(stops)
      setStats({ distanceKm, durationMin })

      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      })
      map.addLayer({
        id:     'route-line',
        type:   'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  { 'line-color': '#10b981', 'line-width': 4, 'line-opacity': 0.85 },
      })

      // Depot marker
      new mapboxgl.Marker({ element: makeDepotMarkerEl() })
        .setLngLat([DEPOT_LNG, DEPOT_LAT])
        .setPopup(
          new mapboxgl.Popup({ offset: 14, closeButton: false })
            .setHTML('<div style="font-size:12px;font-weight:600;padding:2px 4px">Depot</div>'),
        )
        .addTo(map)

      // Numbered cluster markers
      valid.forEach((cluster, idx) => {
        const el = document.createElement('div')
        el.style.cssText = [
          'width:26px', 'height:26px', 'border-radius:50%',
          'background:#10b981',
          'color:white', 'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:11px', 'font-weight:700', 'border:2.5px solid white',
          'box-shadow:0 1px 4px rgba(0,0,0,0.35)', 'cursor:pointer',
        ].join(';')
        el.textContent = String(idx + 1)

        new mapboxgl.Marker({ element: el })
          .setLngLat([Number(cluster.lng), Number(cluster.lat)])
          .setPopup(
            new mapboxgl.Popup({ offset: 14, closeButton: false })
              .setHTML(`<div style="font-size:12px;font-weight:600;padding:2px 4px">${cluster.name}</div>`),
          )
          .addTo(map)
      })

      // Fit map to depot + all clusters
      const allPoints: [number, number][] = [
        [DEPOT_LNG, DEPOT_LAT],
        ...valid.map(c => [Number(c.lng), Number(c.lat)] as [number, number]),
      ]
      const bounds = allPoints.reduce(
        (b, p) => b.extend(p),
        new mapboxgl.LngLatBounds(allPoints[0], allPoints[0]),
      )
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 })
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className ?? 'h-full w-full'} />
      {stats && (
        <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-md px-4 py-2.5 flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>{stats.distanceKm.toFixed(1)} km</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>~{stats.durationMin} min</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>{valid.length} stops</span>
        </div>
      )}
    </div>
  )
}
