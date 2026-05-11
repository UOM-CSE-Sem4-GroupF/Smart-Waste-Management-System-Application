'use client'
import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { ROUTE_COLOURS } from '@/lib/colours'

interface Waypoint {
  lat: number
  lng: number
}

interface RoutePolylineProps {
  map:       mapboxgl.Map
  jobId:     string
  waypoints: Waypoint[]
  index?:    number // for colour cycling
}

export function useRoutePolyline({ map, jobId, waypoints, index = 0 }: RoutePolylineProps) {
  const sourceId = `route-${jobId}`
  const layerId  = `route-line-${jobId}`
  const colour   = ROUTE_COLOURS[index % ROUTE_COLOURS.length]

  useEffect(() => {
    if (!map || waypoints.length < 2) return

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map((w) => [w.lng, w.lat]),
      },
    }

    // Remove stale source/layer if present (e.g. route was updated)
    if (map.getSource(sourceId)) {
      const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource
      src.setData(geojson)
      return
    }

    map.addSource(sourceId, { type: 'geojson', data: geojson })
    map.addLayer({
      id:     layerId,
      type:   'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap':  'round',
      },
      paint: {
        'line-color':   colour,
        'line-width':   3,
        'line-opacity': 0.75,
        'line-dasharray': [4, 2],
      },
    })

    return () => {
      if (map.getLayer(layerId))  map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, jobId, waypoints])
}
