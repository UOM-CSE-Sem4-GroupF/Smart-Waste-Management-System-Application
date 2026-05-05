'use client'
import { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useBinStore }     from '@/store/binStore'
import { useVehicleStore } from '@/store/vehicleStore'
import { useJobStore }     from '@/store/jobStore'

// Fix Leaflet default marker icon path broken by Next.js bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS = {
  normal:   '#22c55e',
  monitor:  '#eab308',
  urgent:   '#f97316',
  critical: '#ef4444',
  offline:  '#6b7280',
} as const

function truckIcon(heading = 0) {
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${heading}deg);font-size:20px;line-height:1">🚛</div>`,
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  })
}

export function MapInner() {
  const bins     = useBinStore((s) => s.bins)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const jobProgress = useJobStore((s) => s.jobProgress)

  const binMarkers     = useMemo(() => Array.from(bins.values()), [bins])
  const vehicleMarkers = useMemo(() => Array.from(vehicles.values()), [vehicles])

  // Build route polylines from active job progress waypoints
  const routeLines = useMemo(() => {
    return Array.from(jobProgress.values()).flatMap((jp) =>
      jp.waypoints.map((wp, i, arr) => {
        if (i === arr.length - 1) return null
        const next = arr[i + 1]
        // We don't have lat/lng in waypoints — skip polyline if not available
        return null as null // waypoints have cluster info but not coords in JobProgress
      }).filter(Boolean),
    )
  }, [jobProgress])
  void routeLines // reserved for when waypoint coords are added

  // Default center: Colombo, Sri Lanka
  const center: [number, number] = [6.9271, 79.8612]

  // If we have bins with real coords, center on the first one
  const firstBin = binMarkers.find((b) => b.lat !== undefined)
  const mapCenter = firstBin
    ? [firstBin.lat, firstBin.lng] as [number, number]
    : center

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Bin circle markers */}
      {binMarkers.map((bin) => {
        if (!bin.lat || !bin.lng) return null
        const color  = STATUS_COLORS[bin.status] ?? '#6b7280'
        const radius = 6 + (bin.fill_level_pct / 100) * 8   // 6–14 px
        return (
          <CircleMarker
            key={bin.bin_id}
            center={[bin.lat, bin.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1 }}
          >
            <Popup>
              <div className="min-w-[160px] space-y-1 text-xs">
                <p className="font-semibold">{bin.bin_id}</p>
                <p>Zone: {bin.zone_id} · Cluster: {bin.cluster_name}</p>
                <p>Fill: {bin.fill_level_pct.toFixed(1)}%</p>
                <p>Status: <span style={{ color }}>{bin.status}</span></p>
                <p>Est. weight: {bin.estimated_weight_kg.toFixed(1)} kg</p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Vehicle markers */}
      {vehicleMarkers.map((v) => {
        if (!v.lat || !v.lng) return null
        return (
          <Marker
            key={v.vehicle_id}
            position={[v.lat, v.lng]}
            icon={truckIcon(v.heading_degrees ?? 0)}
          >
            <Popup>
              <div className="min-w-[160px] space-y-1 text-xs">
                <p className="font-semibold">{v.vehicle_id}</p>
                <p>Driver: {v.driver_id}</p>
                <p>Job: {v.job_id}</p>
                <p>Cargo: {v.cargo_weight_kg.toFixed(1)} / {v.cargo_limit_kg} kg</p>
                <p>Bins: {v.bins_collected}/{v.bins_total}</p>
                {v.current_cluster && <p>Current cluster: {v.current_cluster}</p>}
                {v.next_cluster    && <p>Next cluster: {v.next_cluster}</p>}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
