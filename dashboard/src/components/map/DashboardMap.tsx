'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, getMapboxStyle } from '@/lib/mapbox'
import { useMapStore } from '@/store/mapStore'
import { useBinMarker } from './BinMarker'
import { useVehicleMarker } from './VehicleMarker'
import { STATUS_COLORS } from '@/lib/colours'

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
  const bins = useMapStore((s) => s.getFilteredBins())

  return (
    <>
      {Array.from(bins.values()).map((bin) => (
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

  const handleBinSelect   = useCallback((id: string) => {
    useMapStore.getState().selectBin(id)
    onBinSelect?.(id)
  }, [onBinSelect])

  const handleVehicleSelect = useCallback((jid: string) => {
    onVehicleSelect?.(jid)
  }, [onVehicleSelect])

  useEffect(() => {
    if (!containerRef.current) return

    if (!MAPBOX_TOKEN) {
      console.warn('[DashboardMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const style = getMapboxStyle(prefersDark ? 'dark' : 'light')

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
      {mapLoaded && mapRef.current && !compact && (
        <>
          <BinMarkersLayer    map={mapRef.current} onSelect={handleBinSelect} />
          <VehicleMarkersLayer map={mapRef.current} onSelect={handleVehicleSelect} />
        </>
      )}
    </div>
  )
}
