'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'

interface ZoneFeature {
  zone_id: number
  zone_name: string
  /** GeoJSON polygon coordinates */
  polygon: [number, number][][]
}

interface Props {
  map: mapboxgl.Map
  zones: ZoneFeature[]
}

export function ZoneOverlay({ map, zones }: Props) {
  useEffect(() => {
    const sourceId = 'zones-source'
    const fillLayerId = 'zones-fill'
    const lineLayerId = 'zones-line'
    const labelLayerId = 'zones-label'

    // Cleanup previous
    for (const id of [labelLayerId, lineLayerId, fillLayerId]) {
      if (map.getLayer(id)) map.removeLayer(id)
    }
    if (map.getSource(sourceId)) map.removeSource(sourceId)

    if (!zones.length) return

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
      type: 'FeatureCollection',
      features: zones.map((z) => ({
        type: 'Feature',
        properties: { zone_id: z.zone_id, zone_name: z.zone_name },
        geometry: { type: 'Polygon', coordinates: z.polygon },
      })),
    }

    map.addSource(sourceId, { type: 'geojson', data: geojson })

    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 },
    })

    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.6 },
    })

    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'zone_name'],
        'text-size': 13,
        'text-anchor': 'center',
      },
      paint: { 'text-color': '#1d4ed8', 'text-halo-color': '#fff', 'text-halo-width': 1 },
    })

    return () => {
      for (const id of [labelLayerId, lineLayerId, fillLayerId]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, zones])

  return null
}
