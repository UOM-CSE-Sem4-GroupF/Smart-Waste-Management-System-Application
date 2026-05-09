'use client'

import { useMemo, useState, useCallback } from 'react'
import Map, { Marker, Popup, type MarkerEvent } from 'react-map-gl/mapbox'
import { useBinStore }     from '@/store/binStore'
import { useVehicleStore } from '@/store/vehicleStore'
import { cn } from '@/lib/utils'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

const STATUS_COLORS = {
  normal:   '#10b981',
  monitor:  '#f59e0b',
  urgent:   '#f43f5e',
  critical: '#e11d48',
  offline:  '#94a3b8',
} as const

export function MapInner() {
  const bins             = useBinStore((s) => s.bins)
  const vehicles         = useVehicleStore((s) => s.vehicles)
  const setSelectedBinId = useBinStore((s) => s.setSelectedBinId)
  const selectedBinId    = useBinStore((s) => s.selectedBinId)

  const [popupBinId,     setPopupBinId]     = useState<string | null>(null)
  const [popupVehicleId, setPopupVehicleId] = useState<string | null>(null)

  const binMarkers     = useMemo(() => Array.from(bins.values()), [bins])
  const vehicleMarkers = useMemo(() => Array.from(vehicles.values()), [vehicles])

  const firstBin = binMarkers.find((b) => b.lat !== undefined)
  const initialViewState = {
    longitude: firstBin?.lng ?? 79.8612,
    latitude:  firstBin?.lat ?? 6.9271,
    zoom: 14,
  }

  const handleMapClick = useCallback(() => {
    setSelectedBinId(null)
    setPopupBinId(null)
    setPopupVehicleId(null)
  }, [setSelectedBinId])

  const popupBin     = popupBinId     ? bins.get(popupBinId)         : null
  const popupVehicle = popupVehicleId ? vehicles.get(popupVehicleId) : null

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
      <style>{`
        .bin-pulse { animation: bin-pulse 2.5s infinite; }
        @keyframes bin-pulse {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 0.8; }
          50%       { box-shadow: 0 0 0 8px transparent; opacity: 1; }
        }
        .mapboxgl-popup-content {
          border-radius: 16px !important;
          padding: 8px !important;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1) !important;
        }
        .mapboxgl-popup-tip { display: none !important; }
      `}</style>

      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        onClick={handleMapClick}
      >
        {/* Bin Markers */}
        {binMarkers.map((bin) => {
          if (!bin.lat || !bin.lng) return null
          const color      = STATUS_COLORS[bin.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.offline
          const isCritical = bin.status === 'critical' || bin.status === 'urgent'
          const isSelected = selectedBinId === bin.bin_id
          const size       = isSelected ? 20 : isCritical ? 16 : 12

          return (
            <Marker
              key={bin.bin_id}
              longitude={bin.lng}
              latitude={bin.lat}
              anchor="center"
              onClick={(e: MarkerEvent<MouseEvent>) => {
                e.originalEvent?.stopPropagation()
                setSelectedBinId(bin.bin_id)
                setPopupBinId(bin.bin_id)
                setPopupVehicleId(null)
              }}
            >
              <div
                className={isCritical ? 'bin-pulse' : ''}
                style={{
                  width:           size,
                  height:          size,
                  borderRadius:    '50%',
                  backgroundColor: color,
                  border:          isSelected
                    ? '3px solid #3b82f6'
                    : isCritical
                      ? `2px solid ${color}`
                      : '2px solid white',
                  cursor:     'pointer',
                  transition: 'all 0.2s',
                  color:      color,
                }}
              />
            </Marker>
          )
        })}

        {/* Bin Popup */}
        {popupBin && popupBin.lat && popupBin.lng && (
          <Popup
            longitude={popupBin.lng}
            latitude={popupBin.lat}
            anchor="bottom"
            offset={12}
            closeButton={false}
            onClose={() => setPopupBinId(null)}
          >
            <div className="min-w-[180px] space-y-2 p-1 text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold tracking-tight text-slate-900">{popupBin.bin_id}</span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter',
                  popupBin.status === 'critical' || popupBin.status === 'urgent'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600',
                )}>
                  {popupBin.status}
                </span>
              </div>
              <div className="space-y-1 text-slate-500">
                <div className="flex justify-between">
                  <span className="font-medium">Zone</span>
                  <span className="text-slate-900">{popupBin.zone_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Fill Level</span>
                  <span className="font-black text-slate-900">{popupBin.fill_level_pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* Vehicle Markers */}
        {vehicleMarkers.map((v) => {
          if (!v.lat || !v.lng) return null
          return (
            <Marker
              key={v.vehicle_id}
              longitude={v.lng}
              latitude={v.lat}
              anchor="center"
              onClick={(e: MarkerEvent<MouseEvent>) => {
                e.originalEvent?.stopPropagation()
                setPopupVehicleId(v.vehicle_id)
                setPopupBinId(null)
              }}
            >
              <div style={{
                transform:  `rotate(${v.heading_degrees ?? 0}deg)`,
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor:     'pointer',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"
                    fill="#0f172a"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Marker>
          )
        })}

        {/* Vehicle Popup */}
        {popupVehicle && (
          <Popup
            longitude={popupVehicle.lng}
            latitude={popupVehicle.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            onClose={() => setPopupVehicleId(null)}
          >
            <div className="min-w-[180px] space-y-2 p-1 text-[11px] text-slate-600">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-black tracking-tight text-slate-900">{popupVehicle.vehicle_id}</span>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600">Live</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-medium">Operator</span>
                  <span className="text-slate-900">{popupVehicle.driver_id}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase tracking-tighter">Cargo Load</span>
                    <span className="font-bold text-slate-900">
                      {Math.round((popupVehicle.cargo_weight_kg / popupVehicle.cargo_limit_kg) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-900 transition-all duration-1000"
                      style={{ width: `${(popupVehicle.cargo_weight_kg / popupVehicle.cargo_limit_kg) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend Overlay */}
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-2xl shadow-slate-200/50 backdrop-blur-md">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            City Intelligence
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
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
