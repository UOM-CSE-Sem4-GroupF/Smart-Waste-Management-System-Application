'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEPOT_LAT, DEPOT_LNG } from '@/lib/mapbox'

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

async function fetchOsrmRoute(stops: { lat: number; lng: number }[]): Promise<[number, number][]> {
  if (stops.length < 2) return stops.map(s => [s.lng, s.lat])
  try {
    const coords = stops.map(s => `${s.lng},${s.lat}`).join(';')
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) throw new Error()
    const data = await res.json() as { routes?: Array<{ geometry?: { coordinates?: [number, number][] } }> }
    return data.routes?.[0]?.geometry?.coordinates ?? stops.map(s => [s.lng, s.lat])
  } catch {
    return stops.map(s => [s.lng, s.lat])
  }
}

function stopColor(status?: string) {
  if (status === 'completed') return '#22c55e'
  if (status === 'current')   return '#3b82f6'
  return '#f59e0b'
}

function makeDepotMarkerEl() {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:30px', 'height:30px', 'border-radius:50%',
    'background:#6366f1',
    'color:white', 'display:flex', 'align-items:center', 'justify-content:center',
    'border:2.5px solid white', 'box-shadow:0 1px 4px rgba(0,0,0,0.35)', 'cursor:pointer',
  ].join(';')
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="white">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>`
  return el
}

export interface RouteStop {
  sequence:     number
  cluster_id:   string
  cluster_name: string
  lat:          number
  lng:          number
  status?:      'completed' | 'current' | 'pending'
}

interface Props {
  stops:     RouteStop[]
  polyline?: string | null
  className?: string
}

export function JobRouteMap({ stops, polyline, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    const valid = stops.filter(s => s.lat && s.lng)
    if (!containerRef.current || mapRef.current || valid.length === 0) return
    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    [valid[0].lng, valid[0].lat],
      zoom:      13,
    })
    mapRef.current = map

    map.on('load', async () => {
      const useStoredPolyline = typeof polyline === 'string' && polyline.length > 30
      const osrmStops = [{ lat: DEPOT_LAT, lng: DEPOT_LNG }, ...valid]
      const routeCoords = useStoredPolyline
        ? decodePolyline(polyline!)
        : await fetchOsrmRoute(osrmStops)

      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } },
      })
      map.addLayer({
        id:     'route-line',
        type:   'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint:  { 'line-color': '#10b981', 'line-width': 3.5, 'line-opacity': 0.85 },
      })

      // Depot home marker
      new mapboxgl.Marker({ element: makeDepotMarkerEl() })
        .setLngLat([DEPOT_LNG, DEPOT_LAT])
        .setPopup(
          new mapboxgl.Popup({ offset: 14, closeButton: false })
            .setHTML('<div style="font-size:12px;font-weight:600">Depot</div>'),
        )
        .addTo(map)

      // Numbered cluster stop markers
      valid.forEach((stop, idx) => {
        const el = document.createElement('div')
        el.style.cssText = [
          'width:26px', 'height:26px', 'border-radius:50%',
          `background:${stopColor(stop.status)}`,
          'color:white', 'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:11px', 'font-weight:700', 'border:2.5px solid white',
          'box-shadow:0 1px 4px rgba(0,0,0,0.35)', 'cursor:pointer',
        ].join(';')
        el.textContent = String(stop.sequence ?? idx + 1)

        new mapboxgl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14, closeButton: false })
              .setHTML(`<div style="font-size:12px;font-weight:600">${stop.cluster_name}</div>`),
          )
          .addTo(map)
      })

      // Fit depot + all stops in view
      const allPoints: [number, number][] = [[DEPOT_LNG, DEPOT_LAT], ...valid.map(s => [s.lng, s.lat] as [number, number])]
      if (allPoints.length > 1) {
        const bounds = allPoints.reduce(
          (b, p) => b.extend(p),
          new mapboxgl.LngLatBounds(allPoints[0], allPoints[0]),
        )
        map.fitBounds(bounds, { padding: 48, maxZoom: 15 })
      }
    })

    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, polyline])

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-64 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700'}
    />
  )
}
