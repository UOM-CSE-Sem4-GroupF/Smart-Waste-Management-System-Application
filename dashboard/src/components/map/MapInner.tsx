'use client'

import { useMemo, useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useBinStore }     from '@/store/binStore'
import { useVehicleStore } from '@/store/vehicleStore'
import { cn } from '@/lib/utils'

// Fix Leaflet default marker icon path
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS = {
  normal:   '#10b981', // Emerald 500
  monitor:  '#f59e0b', // Amber 500
  urgent:   '#f43f5e', // Rose 500
  critical: '#e11d48', // Rose 600
  offline:  '#94a3b8', // Slate 400
} as const

function vehicleIcon(heading = 0, status: 'active' | 'idle' = 'active') {
  const color = status === 'active' ? '#0f172a' : '#64748b' // Dark navy for Uber-like pointer
  return L.divIcon({
    className: 'custom-vehicle-icon',
    html: `
      <div style="transform: rotate(${heading}deg); transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Click outside markers to deselect
function MapEvents() {
  const setSelectedBinId = useBinStore((s) => s.setSelectedBinId)
  useMapEvents({
    click: () => setSelectedBinId(null),
  })
  return null
}

export function MapInner() {
  const bins     = useBinStore((s) => s.bins)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const setSelectedBinId = useBinStore((s) => s.setSelectedBinId)
  const selectedBinId    = useBinStore((s) => s.selectedBinId)
  const [isReady, setIsReady] = useState(false)

  const binMarkers     = useMemo(() => Array.from(bins.values()), [bins])
  const vehicleMarkers = useMemo(() => Array.from(vehicles.values()), [vehicles])

  useEffect(() => {
    setIsReady(true)
  }, [])

  // Default center: Colombo, Sri Lanka
  const center: [number, number] = [6.9271, 79.8612]
  const firstBin = binMarkers.find((b) => b.lat !== undefined)
  const mapCenter = firstBin ? [firstBin.lat, firstBin.lng] as [number, number] : center

  if (!isReady) return null

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] shadow-xl shadow-slate-200/50">
      <style>{`
        .leaflet-container { background: #f1f5f9 !important; font-family: inherit; cursor: crosshair !important; }
        .pulse-marker {
          animation: marker-pulse 2.5s infinite;
        }
        @keyframes marker-pulse {
          0% { stroke-width: 2; stroke-opacity: 0.8; r: 6; }
          100% { stroke-width: 12; stroke-opacity: 0; r: 14; }
        }
        .premium-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 4px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
        .premium-popup .leaflet-popup-tip {
          display: none;
        }
      `}</style>

      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        zoomControl={false}
      >
        <MapEvents />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Bin Markers */}
        {binMarkers.map((bin) => {
          if (!bin.lat || !bin.lng) return null
          const color  = STATUS_COLORS[bin.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.offline
          const isCritical = bin.status === 'critical' || bin.status === 'urgent'
          const isSelected = selectedBinId === bin.bin_id
          
          return (
            <CircleMarker
              key={bin.bin_id}
              center={[bin.lat, bin.lng]}
              radius={isSelected ? 10 : (isCritical ? 8 : 6)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e)
                  setSelectedBinId(bin.bin_id)
                }
              }}
              pathOptions={{ 
                color: isSelected ? '#3b82f6' : (isCritical ? color : 'white'), 
                fillColor: color, 
                fillOpacity: 0.9, 
                weight: isSelected ? 4 : 2,
                className: isCritical ? 'pulse-marker' : ''
              }}
            >
              <Popup className="premium-popup">
                <div className="min-w-[180px] space-y-2 p-1 text-[11px]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold tracking-tight text-slate-900">{bin.bin_id}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter",
                      isCritical ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {bin.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-500">
                    <div className="flex justify-between">
                      <span className="font-medium">Zone</span> <span className="text-slate-900">{bin.zone_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Fill Level</span> <span className="font-black text-slate-900">{bin.fill_level_pct.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Vehicle Markers */}
        {vehicleMarkers.map((v) => {
          if (!v.lat || !v.lng) return null
          return (
            <Marker
              key={v.vehicle_id}
              position={[v.lat, v.lng]}
              icon={vehicleIcon(v.heading_degrees ?? 0, 'active')}
            >
              <Popup className="premium-popup">
                <div className="min-w-[180px] space-y-2 p-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-black text-slate-900 tracking-tight">{v.vehicle_id}</span>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600">Live</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Operator</span> <span className="text-slate-900">{v.driver_id}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-bold uppercase tracking-tighter">Cargo Load</span>
                        <span className="text-slate-900 font-bold">{Math.round((v.cargo_weight_kg / v.cargo_limit_kg) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div 
                          className="h-full bg-slate-900 transition-all duration-1000" 
                          style={{ width: `${(v.cargo_weight_kg / v.cargo_limit_kg) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Modern Control Overlay */}
      <div className="absolute top-6 left-6 z-[1000]">
        <div className="rounded-2xl bg-white/90 p-4 shadow-2xl shadow-slate-200/50 backdrop-blur-md border border-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
            City Intelligence
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
              <span className="text-xs font-bold text-slate-700">Urgent Response</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700">Fleet Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



