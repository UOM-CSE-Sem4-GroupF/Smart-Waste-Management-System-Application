'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { VEHICLE_ROUTE_COLOURS, DEFAULT_ROUTE_COLOUR } from '@/lib/mapbox'
import type { CollectionJob } from '@/types/job'

interface Props {
  map: mapboxgl.Map
  job: CollectionJob
  /** Ordered [lng, lat] waypoints */
  waypoints: [number, number][]
}

export function RoutePolyline({ map, job, waypoints }: Props) {
  const sourceId = `route-${job.job_id}`
  const layerId = `route-layer-${job.job_id}`

  useEffect(() => {
    if (waypoints.length < 2) return

    const colour =
      VEHICLE_ROUTE_COLOURS[job.vehicle_id ?? ''] ?? DEFAULT_ROUTE_COLOUR

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: waypoints,
      },
    }

    // Remove stale source/layer from a previous render
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(sourceId)) map.removeSource(sourceId)

    map.addSource(sourceId, { type: 'geojson', data: geojson })
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': colour,
        'line-width': 3,
        'line-dasharray':
          job.state === 'IN_PROGRESS' ? [1, 0] : [4, 3],
        'line-opacity': 0.8,
      },
    })

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, job.job_id, job.state, waypoints])

  return null
}
