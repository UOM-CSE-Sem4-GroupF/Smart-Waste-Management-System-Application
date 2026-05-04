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
          {showIndividualBins
            ? Array.from(filteredBins.values()).map((bin) => (
                <BinMarker key={bin.bin_id} map={map} bin={bin} onSelect={handleSelectBin} />
              ))
            : clusters.map((cluster) => (
                <ClusterMarker
                  key={cluster.cluster_id}
                  map={map}
                  cluster={cluster}
                  onSelect={handleSelectCluster}
                />
              ))}

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
