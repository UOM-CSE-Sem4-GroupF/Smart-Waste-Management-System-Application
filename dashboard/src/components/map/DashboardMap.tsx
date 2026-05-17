'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTheme } from 'next-themes'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, getMapboxStyle } from '@/lib/mapbox'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { useBinMarker } from './BinMarker'
import { useVehicleMarker } from './VehicleMarker'
import { useRoutePolyline } from './RoutePolyline'
import { STATUS_COLORS } from '@/lib/colours'
import type { JobState } from '@/types'

/** Build a rectangular GeoJSON ring (closed) around a set of lat/lng points */
function bboxRing(lats: number[], lngs: number[], buffer: number): number[][] {
  const minLat = Math.min(...lats) - buffer
  const maxLat = Math.max(...lats) + buffer
  const minLng = Math.min(...lngs) - buffer
  const maxLng = Math.max(...lngs) + buffer
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ]
}

interface DashboardMapProps {
  /** Compact mode (e.g. overview mini-map): no controls, non-interactive */
  compact?: boolean
  /** If set, show only the active route for this job */
  jobId?: string
  className?: string
  onBinSelect?: (binId: string) => void
  onVehicleSelect?: (jobId: string) => void
}

/** Internal — renders bin markers by calling the useBinMarker hook for each bin */
function BinMarkersLayer({
  map,
  onSelect,
}: {
  map: mapboxgl.Map
  onSelect: (id: string) => void
}) {
  const rawBins  = useMapStore((s) => s.bins)
  const filters  = useMapStore((s) => s.filters)
  const bins = useMemo(() => {
    return Array.from(rawBins.values()).filter((bin) => {
      if (filters.zoneId && bin.zone_id !== filters.zoneId) return false
      if (filters.clusterId && bin.cluster_id !== filters.clusterId) return false
      if (filters.status.length && !filters.status.includes(bin.status)) return false
      if (filters.wasteCategory.length && !filters.wasteCategory.includes(bin.waste_category)) return false
      return true
    })
  }, [rawBins, filters])

  return (
    <>
      {bins.map((bin) => (
        <BinMarkerItem key={bin.bin_id} map={map} bin={bin} onSelect={onSelect} />
      ))}
    </>
  )
}

function BinMarkerItem({
  map,
  bin,
  onSelect,
}: {
  map: mapboxgl.Map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bin: any
  onSelect: (id: string) => void
}) {
  useBinMarker({ map, bin, onSelect })
  return null
}

function VehicleMarkersLayer({
  map,
  onSelect,
}: {
  map: mapboxgl.Map
  onSelect: (jobId: string) => void
}) {
  const vehicles = useMapStore((s) => s.vehicles)

  return (
    <>
      {Array.from(vehicles.values()).map((v) => (
        <VehicleMarkerItem key={v.vehicle_id} map={map} vehicle={v} onSelect={onSelect} />
      ))}
    </>
  )
}

function VehicleMarkerItem({
  map,
  vehicle,
  onSelect,
}: {
  map: mapboxgl.Map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vehicle: any
  onSelect: (jobId: string) => void
}) {
  useVehicleMarker({ map, vehicle, onSelect })
  return null
}

const ZONE_COLORS    = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']
const CLUSTER_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#8b5cf6']

/** Renders zone and cluster boundary polygons as Mapbox GL fill/line layers */
function ZoneClusterOverlaysLayer({ map }: { map: mapboxgl.Map }) {
  const bins         = useMapStore((s) => s.bins)
  const zoneStats    = useMapStore((s) => s.zoneStats)
  const showZones    = useMapStore((s) => s.filters.showZones)
  const showClusters = useMapStore((s) => s.filters.showClusters)

  // Zone overlay layers
  useEffect(() => {
    const SRC   = 'zone-overlays'
    const FILL  = 'zone-fills'
    const LINE  = 'zone-lines'
    const LABEL = 'zone-labels'

    const cleanup = () => {
      if (map.getLayer(LABEL)) map.removeLayer(LABEL)
      if (map.getLayer(LINE))  map.removeLayer(LINE)
      if (map.getLayer(FILL))  map.removeLayer(FILL)
      if (map.getSource(SRC))  map.removeSource(SRC)
    }

    if (!showZones) { cleanup(); return }

    // Group bins by zone_id
    const groups = new Map<number, { lats: number[]; lngs: number[]; name: string }>()
    for (const bin of bins.values()) {
      if (bin.lat == null || bin.lng == null) continue
      if (!groups.has(bin.zone_id)) {
        const zs = zoneStats.get(bin.zone_id)
        groups.set(bin.zone_id, { lats: [], lngs: [], name: zs?.zone_name ?? `Zone ${bin.zone_id}` })
      }
      const g = groups.get(bin.zone_id)!
      g.lats.push(bin.lat)
      g.lngs.push(bin.lng)
    }

    if (groups.size === 0) return

    const features = Array.from(groups.entries()).map(([zoneId, { lats, lngs, name }], i) => ({
      type: 'Feature' as const,
      properties: { id: zoneId, name, color: ZONE_COLORS[i % ZONE_COLORS.length] },
      geometry: { type: 'Polygon' as const, coordinates: [bboxRing(lats, lngs, 0.003)] },
    }))

    cleanup()
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({ id: FILL, type: 'fill', source: SRC,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 } })
    map.addLayer({ id: LINE, type: 'line', source: SRC,
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.7,
               'line-dasharray': [4, 2] } })
    map.addLayer({ id: LABEL, type: 'symbol', source: SRC,
      layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'center' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } })

    return cleanup
  }, [map, bins, zoneStats, showZones])

  // Cluster overlay layers
  useEffect(() => {
    const SRC   = 'cluster-overlays'
    const FILL  = 'cluster-fills'
    const LINE  = 'cluster-lines'
    const LABEL = 'cluster-labels'

    const cleanup = () => {
      if (map.getLayer(LABEL)) map.removeLayer(LABEL)
      if (map.getLayer(LINE))  map.removeLayer(LINE)
      if (map.getLayer(FILL))  map.removeLayer(FILL)
      if (map.getSource(SRC))  map.removeSource(SRC)
    }

    if (!showClusters) { cleanup(); return }

    // Group bins by cluster_id
    const groups = new Map<string, { lats: number[]; lngs: number[]; name: string }>()
    for (const bin of bins.values()) {
      if (bin.lat == null || bin.lng == null || !bin.cluster_id) continue
      if (!groups.has(bin.cluster_id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        groups.set(bin.cluster_id, { lats: [], lngs: [], name: (bin as any).cluster_name ?? bin.cluster_id })
      }
      const g = groups.get(bin.cluster_id)!
      g.lats.push(bin.lat)
      g.lngs.push(bin.lng)
    }

    if (groups.size === 0) return

    const features = Array.from(groups.entries()).map(([clusterId, { lats, lngs, name }], i) => ({
      type: 'Feature' as const,
      properties: { id: clusterId, name, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] },
      geometry: { type: 'Polygon' as const, coordinates: [bboxRing(lats, lngs, 0.001)] },
    }))

    cleanup()
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({ id: FILL, type: 'fill', source: SRC,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } })
    map.addLayer({ id: LINE, type: 'line', source: SRC,
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.8,
               'line-dasharray': [2, 1.5] } })
    map.addLayer({ id: LABEL, type: 'symbol', source: SRC,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-anchor': 'center' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } })

    return cleanup
  }, [map, bins, showClusters])

  return null
}

const ACTIVE_ROUTE_STATES: JobState[] = [
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'SPLIT_JOB', 'COMPLETING',
  'COLLECTION_DONE', 'RECORDING_AUDIT', 'AUDIT_RECORDED',
]

function RoutePolylineItem({
  map, jobId, waypoints, index,
}: {
  map: mapboxgl.Map
  jobId: string
  waypoints: { lat: number; lng: number }[]
  index: number
}) {
  useRoutePolyline({ map, jobId, waypoints, index })
  return null
}

function RoutePolylinesLayer({
  map,
  filterJobId,
}: {
  map: mapboxgl.Map
  filterJobId?: string
}) {
  const jobs = useJobStore((s) => s.jobs)

  const routeJobs = useMemo(() => {
    return Array.from(jobs.values()).filter((job) => {
      if (filterJobId && job.job_id !== filterJobId) return false
      if (!job.route?.length) return false
      if (job.state && !ACTIVE_ROUTE_STATES.includes(job.state)) return false
      return true
    })
  }, [jobs, filterJobId])

  return (
    <>
      {routeJobs.map((job, i) => (
        <RoutePolylineItem
          key={job.job_id}
          map={map}
          jobId={job.job_id}
          waypoints={job.route.map((wp) => ({ lat: wp.lat, lng: wp.lng }))}
          index={i}
        />
      ))}
    </>
  )
}

export default function DashboardMap({
  compact = false,
  jobId,
  className = '',
  onBinSelect,
  onVehicleSelect,
}: DashboardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { resolvedTheme } = useTheme()

  const handleBinSelect   = useCallback((id: string) => {
    useMapStore.getState().selectBin(id)
    onBinSelect?.(id)
  }, [onBinSelect])

  const handleVehicleSelect = useCallback((vehicleId: string) => {
    useMapStore.getState().selectVehicle(vehicleId)
    onVehicleSelect?.(vehicleId)
  }, [onVehicleSelect])

  useEffect(() => {
    if (!containerRef.current) return

    if (!MAPBOX_TOKEN) {
      console.warn('[DashboardMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN

    const style = getMapboxStyle(resolvedTheme === 'dark' ? 'dark' : 'light')

    const map = new mapboxgl.Map({
      container:    containerRef.current,
      style,
      center:       DEFAULT_CENTER,
      zoom:         DEFAULT_ZOOM,
      interactive:  !compact,
      attributionControl: !compact,
      logoPosition: 'bottom-left',
    })

    if (!compact) {
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }), 'top-right')
    }

    // Add bin-pulse CSS animation once
    if (!document.getElementById('mapbox-bin-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'mapbox-bin-pulse-style'
      style.textContent = `
        @keyframes bin-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0);   }
          100% { box-shadow: 0 0 0 0   rgba(239,68,68,0);   }
        }
        .bin-marker[style*='animation'] {
          animation: bin-pulse 1.5s ease-in-out infinite;
        }
      `
      document.head.appendChild(style)
    }

    map.on('load', () => {
      mapRef.current = map
      setMapLoaded(true)
    })

    return () => {
      setMapLoaded(false)
      mapRef.current = null
      map.remove()
    }
  }, [compact])

  // Update map style reactively when dark/light theme changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    mapRef.current.setStyle(getMapboxStyle(resolvedTheme === 'dark' ? 'dark' : 'light'))
  }, [resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground text-sm ${className}`}>
        Map unavailable — check Mapbox token
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend — only in full mode */}
      {!compact && (
        <div className="absolute bottom-8 left-2 bg-background/90 backdrop-blur-sm border rounded-lg p-2 text-xs space-y-1 z-10 shadow-md">
          {(Object.entries(STATUS_COLORS) as [string, string][]).map(([status, hex]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: hex }} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Marker layers — only mount after Mapbox initialised */}
      {mapLoaded && mapRef.current && (
        <>
          <ZoneClusterOverlaysLayer map={mapRef.current} />
          <RoutePolylinesLayer map={mapRef.current} filterJobId={jobId} />
          <BinMarkersLayer    map={mapRef.current} onSelect={handleBinSelect} />
          <VehicleMarkersLayer map={mapRef.current} onSelect={handleVehicleSelect} />
        </>
      )}
    </div>
  )
}
