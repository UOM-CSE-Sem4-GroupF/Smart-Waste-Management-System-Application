'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { MAPBOX_TOKEN, MAPBOX_STYLE } from '@/lib/mapbox'
import { BinMarker } from './BinMarker'
import { ClusterMarker } from './ClusterMarker'
import { VehicleMarker } from './VehicleMarker'
import { RoutePolyline } from './RoutePolyline'
import { ZoneOverlay } from './ZoneOverlay'
import { BinDetailPanel } from './BinDetailPanel'
import type { Cluster } from '@/types/cluster'

/** Colombo default center */
const DEFAULT_CENTER: [number, number] = [79.8612, 6.9271]
const DEFAULT_ZOOM = 12

/** Build synthetic Cluster objects from bins (for low-zoom display) */
function deriveClusters(bins: ReturnType<typeof useMapStore.getState>['bins']): Cluster[] {
  const map = new Map<string, Cluster>()
  for (const bin of bins.values()) {
    const existing = map.get(bin.cluster_id)
    if (!existing) {
      map.set(bin.cluster_id, {
        cluster_id:     bin.cluster_id,
        cluster_name:   bin.cluster_name,
        lat:            bin.lat ?? 0,
        lng:            bin.lng ?? 0,
        zone_id:        bin.zone_id,
        bin_count:      1,
        cluster_status: bin.status as Cluster['cluster_status'],
      })
    } else {
      // Pick worst status and accumulate count
      const statuses = ['critical', 'urgent', 'monitor', 'normal', 'offline'] as const
      const existingIdx = statuses.indexOf(existing.cluster_status as typeof statuses[number])
      const newIdx      = statuses.indexOf(bin.status as typeof statuses[number])
      map.set(bin.cluster_id, {
        ...existing,
        bin_count:      existing.bin_count + 1,
        cluster_status: (newIdx < existingIdx ? bin.status : existing.cluster_status) as Cluster['cluster_status'],
      })
    }
  }
  return Array.from(map.values())
}

interface Props {
  showZones:  boolean
  showRoutes: boolean
}

export function DashboardMapInner({ showZones, showRoutes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [zoom,     setZoom]     = useState(DEFAULT_ZOOM)

  const bins     = useMapStore((s) => s.bins)
  const vehicles = useMapStore((s) => s.vehicles)
  const selectBin = useMapStore((s) => s.selectBin)
  const getFilteredBins = useMapStore((s) => s.getFilteredBins)
  const jobs     = useJobStore((s) => s.jobs)

  // Apply filters
  const filteredBins = useMemo(() => {
    const filtered = getFilteredBins()
    // filtered returns Bin[], convert to Map for consistent lookup
    return new Map(filtered.map((b) => [b.bin_id, b]))
  }, [getFilteredBins, bins]) // eslint-disable-line react-hooks/exhaustive-deps

  const clusters = useMemo(() => deriveClusters(filteredBins), [filteredBins])

  // Active jobs only (for route polylines)
  const activeJobs = useMemo(
    () => Array.from(jobs.values()).filter((j) => j.state === 'IN_PROGRESS'),
    [jobs],
  )

  const handleSelectBin = useCallback((id: string) => selectBin(id), [selectBin])
  const handleSelectCluster = useCallback((clusterId: string) => {
    // Zoom in to the cluster area
    const map = mapRef.current
    if (!map) return
    const cluster = clusters.find((c) => c.cluster_id === clusterId)
    if (cluster) {
      map.flyTo({ center: [cluster.lng, cluster.lat], zoom: 14, duration: 800 })
    }
  }, [clusters])

  // Initialise map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     MAPBOX_STYLE,
      center:    DEFAULT_CENTER,
      zoom:      DEFAULT_ZOOM,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-left')
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    map.on('load', () => setMapReady(true))
    map.on('zoom', () => setZoom(map.getZoom()))

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const map = mapRef.current
  const showIndividualBins = zoom >= 13
  // Use canvas-based GL layer instead of DOM markers when > 100 bins are visible
  const useCanvasLayer = showIndividualBins && filteredBins.size > 100

  // ── Canvas layer: Mapbox GL source + circle layer for > 100 bins ──────────
  useEffect(() => {
    if (!map || !mapReady) return
    const SOURCE_ID = 'bins-canvas-source'
    const LAYER_ID  = 'bins-canvas-layer'

    if (!useCanvasLayer) {
      // Remove canvas layer when switching back to DOM markers
      if (map.getLayer(LAYER_ID))  map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      return
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: Array.from(filteredBins.values())
        .filter((b) => b.lat != null && b.lng != null)
        .map((b) => ({
          type: 'Feature',
          id:   b.bin_id,
          geometry: { type: 'Point', coordinates: [b.lng!, b.lat!] },
          properties: {
            bin_id:         b.bin_id,
            status:         b.status,
            fill_level_pct: b.fill_level_pct,
          },
        })),
    }

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson)
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
      map.addLayer({
        id:     LAYER_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'fill_level_pct'],
            0, 6, 100, 14,
          ],
          'circle-color': [
            'match', ['get', 'status'],
            'normal',   '#22c55e',
            'monitor',  '#eab308',
            'urgent',   '#f97316',
            'critical', '#ef4444',
            /* default (offline) */ '#6b7280',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      })

      const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const feature = e.features?.[0]
        if (feature?.properties?.bin_id) selectBin(feature.properties.bin_id as string)
      }
      map.on('click', LAYER_ID, onClick)
      map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = '' })
    }

    return () => {
      // Cleanup handled in the !useCanvasLayer branch on next call
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapReady, useCanvasLayer, filteredBins, selectBin])

  return (
    // containerRef must always be mounted so Mapbox attaches to the DOM node
    <div ref={containerRef} className="relative h-full w-full">
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      )}

      {mapReady && map && (
        <>
          {/* Zone polygons */}
          {showZones && <ZoneOverlay map={map} zones={[]} />}

          {/* Bin / cluster markers */}
          {showIndividualBins && !useCanvasLayer
            ? Array.from(filteredBins.values()).map((bin) => (
                <BinMarker key={bin.bin_id} map={map} bin={bin} onSelect={handleSelectBin} />
              ))
            : !showIndividualBins
              ? clusters.map((cluster) => (
                  <ClusterMarker
                    key={cluster.cluster_id}
                    map={map}
                    cluster={cluster}
                    onSelect={handleSelectCluster}
                  />
                ))
              : null /* canvas layer renders the bins, nothing needed in React tree */}

          {/* Vehicle markers */}
          {Array.from(vehicles.values()).map((vehicle) => (
            <VehicleMarker key={vehicle.vehicle_id} map={map} vehicle={vehicle} />
          ))}

          {/* Route polylines */}
          {showRoutes &&
            activeJobs.map((job) => {
              const waypoints: [number, number][] = (job.route ?? []).map(
                (stop) => [stop.lng, stop.lat] as [number, number],
              )
              return (
                <RoutePolyline key={job.job_id} map={map} job={job} waypoints={waypoints} />
              )
            })}
        </>
      )}

      {/* Bin detail side panel (outside map-ready gate, reads from store directly) */}
      <BinDetailPanel />
    </div>
  )
}
