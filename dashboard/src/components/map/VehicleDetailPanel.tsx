'use client'

import { useMemo } from 'react'
import { X, Truck, User, Package, Gauge, Navigation2, MapPin } from 'lucide-react'
import { useMapStore } from '@/store/mapStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

function UtilisationBar({ pct }: { pct: number }) {
  const color =
    pct >= 90 ? '#ef4444' :
    pct >= 70 ? '#f97316' :
    '#22c55e'

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <span>Cargo Utilisation</span>
        <span style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function VehicleDetailPanel() {
  const selectedVehicleId = useMapStore((s) => s.selectedVehicleId)
  const selectVehicle     = useMapStore((s) => s.selectVehicle)
  const vehicles          = useMapStore((s) => s.vehicles)

  const vehicle = useMemo(() =>
    selectedVehicleId ? vehicles.get(selectedVehicleId) : null
  , [selectedVehicleId, vehicles])

  if (!selectedVehicleId) return null

  const utilPct = vehicle?.cargo_utilisation_pct ?? 0

  return (
    <div className="flex h-full w-80 flex-col border-l border-slate-200 bg-white/90 backdrop-blur-xl animate-in slide-in-from-right duration-300 dark:border-slate-800 dark:bg-slate-950/90">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-900">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Vehicle Status
          </span>
          <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
            {vehicle?.vehicle_id ?? selectedVehicleId}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => selectVehicle(null)}
          className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4 pb-10">
          {/* Cargo card */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Live Telemetry
                </span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <UtilisationBar pct={utilPct} />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Weight</p>
                  <p className="text-lg font-black tabular-nums">
                    {vehicle?.cargo_weight_kg ?? 0}
                    <span className="ml-1 text-[10px] font-bold text-slate-400">kg</span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Limit</p>
                  <p className="text-lg font-black tabular-nums">
                    {vehicle?.cargo_limit_kg ?? 0}
                    <span className="ml-1 text-[10px] font-bold text-slate-400">kg</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-500">
                <Package className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Bins Done</span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {vehicle?.bins_collected ?? 0}
                <span className="text-xs font-medium text-slate-400">/{vehicle?.bins_total ?? 0}</span>
              </span>
            </Card>

            <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-500">
                <Gauge className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Speed</span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {vehicle?.speed_kmh ?? 0}
                <span className="text-xs font-medium text-slate-400"> km/h</span>
              </span>
            </Card>

            {vehicle?.heading_degrees !== undefined && (
              <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-slate-500">
                  <Navigation2 className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Heading</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {vehicle.heading_degrees}°
                </span>
              </Card>
            )}

            <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-500">
                <User className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Driver</span>
              </div>
              <span className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                {vehicle?.driver_id ?? '—'}
              </span>
            </Card>
          </div>

          {/* Route info */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Route</p>

            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1 space-y-1">
                {vehicle?.job_id && (
                  <p className="truncate text-xs text-slate-500">
                    Job: <span className="font-semibold text-slate-700 dark:text-slate-300">{vehicle.job_id}</span>
                  </p>
                )}
                {vehicle?.current_cluster && (
                  <p className="truncate text-xs text-slate-500">
                    Current: <span className="font-semibold text-slate-700 dark:text-slate-300">{vehicle.current_cluster}</span>
                  </p>
                )}
                {vehicle?.next_cluster && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <p className="truncate text-xs text-slate-500">
                      Next: <span className="font-semibold text-slate-700 dark:text-slate-300">{vehicle.next_cluster}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Weight warning banner */}
          {vehicle?.weight_limit_warning && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-700 dark:border-orange-800/50 dark:bg-orange-900/20 dark:text-orange-400">
              <span className="text-[11px] font-bold">⚠ Approaching weight limit</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
