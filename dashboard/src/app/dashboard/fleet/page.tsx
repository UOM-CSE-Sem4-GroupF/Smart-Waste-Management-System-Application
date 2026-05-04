'use client'

import { formatDistanceToNow } from 'date-fns'
import { useVehicles } from '@/hooks/useVehicles'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { CargoBar } from '@/components/fleet/CargoBar'
import { AlertFeed } from '@/components/shared/AlertFeed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function FleetPage() {
  const { data, isLoading } = useVehicles()
  const liveVehicles = useMapStore((s) => s.vehicles)

  // Merge REST data with live store state
  const vehicles = (data?.vehicles ?? []).map((v: ActiveVehicle) => {
    const live = liveVehicles.get(v.vehicle_id)
    if (!live) return v
    return {
      ...v,
      cargo_weight_kg:       live.cargo_weight_kg,
      cargo_limit_kg:        live.cargo_limit_kg,
      cargo_utilisation_pct: live.cargo_utilisation_pct,
      bins_collected:        live.bins_collected,
      bins_total:            live.bins_total,
    }
  })

  const onJob   = vehicles.filter((v: ActiveVehicle) => !!v.job_id)
  const waiting = vehicles.filter((v: ActiveVehicle) => !v.job_id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Fleet</h2>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>{onJob.length} on route</span>
          <span>·</span>
          <span>{waiting.length} available</span>
        </div>
      </div>

      {/* Active vehicles */}
      {onJob.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            On Route
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {onJob.map((v: ActiveVehicle) => (
              <VehicleCard key={v.vehicle_id} vehicle={v} active />
            ))}
          </div>
        </section>
      )}

      {/* Idle vehicles */}
      {waiting.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Available
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {waiting.map((v: ActiveVehicle) => (
              <VehicleCard key={v.vehicle_id} vehicle={v} active={false} />
            ))}
          </div>
        </section>
      )}

      {/* Deviation alerts */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Route Deviations
        </h3>
        <AlertFeed />
      </section>
    </div>
  )
}

import type { ActiveVehicle } from '@/types'

function VehicleCard({ vehicle: v, active }: { vehicle: ActiveVehicle; active: boolean }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            {v.vehicle_id}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs capitalize">{v.vehicle_type}</Badge>
            {active
              ? <Badge className="bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 text-xs">On route</Badge>
              : <Badge variant="secondary" className="text-xs">Available</Badge>
            }
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{v.driver_name}</span>
          <span className="text-right">{v.driver_id}</span>

          {v.job_id && (
            <>
              <span className="col-span-2 text-xs">
                Job: <span className="font-medium">{v.job_id.slice(0, 8)}…</span>
                {' '}· Zone {v.zone_id}
              </span>
            </>
          )}

          {active && (
            <span className="col-span-2">
              {v.bins_collected}/{v.bins_total} bins collected
            </span>
          )}

          {v.last_seen_at && (
            <span className="col-span-2 text-xs">
              Last seen {formatDistanceToNow(new Date(v.last_seen_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {active && (
          <CargoBar
            used={v.cargo_weight_kg}
            limit={v.cargo_limit_kg}
            showLabels
          />
        )}
      </CardContent>
    </Card>
  )
}
