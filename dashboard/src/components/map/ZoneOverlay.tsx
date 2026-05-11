'use client'
import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { ZONE_COLOURS } from '@/lib/colours'

interface ZoneFeature {
  zone_id:   number
  zone_name: string
  geojson?:  GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
}

interface ZoneOverlayProps {
  map:   mapboxgl.Map
  zones: ZoneFeature[]
}

export function useZoneOverlays({ map, zones }: ZoneOverlayProps) {
  useEffect(() => {
    if (!map || zones.length === 0) return

    const addedLayers: string[] = []
    const addedSources: string[] = []

    zones.forEach((zone, idx) => {
      if (!zone.geojson) return
      const colour    = ZONE_COLOURS[idx % ZONE_COLOURS.length]
      const sourceId  = `zone-src-${zone.zone_id}`
      const fillId    = `zone-fill-${zone.zone_id}`
      const strokeId  = `zone-stroke-${zone.zone_id}`

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: zone.geojson })
        addedSources.push(sourceId)
      }

      if (!map.getLayer(fillId)) {
        map.addLayer({
          id:     fillId,
          type:   'fill',
          source: sourceId,
          paint: {
            'fill-color':   colour,
            'fill-opacity': 0.08,
          },
        })
        addedLayers.push(fillId)
      }

      if (!map.getLayer(strokeId)) {
        map.addLayer({
          id:     strokeId,
          type:   'line',
          source: sourceId,
          paint: {
            'line-color':   colour,
            'line-width':   1.5,
            'line-opacity': 0.5,
          },
        })
        addedLayers.push(strokeId)
      }
    })

    return () => {
      addedLayers.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      addedSources.forEach((id) => {
        if (map.getSource(id)) map.removeSource(id)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zones.length])
}
