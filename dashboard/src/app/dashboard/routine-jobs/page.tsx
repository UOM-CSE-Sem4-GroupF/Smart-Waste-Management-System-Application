'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Layers } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClientApiClient } from '@/lib/api-client'
import { listZones, listClusters } from '@/lib/api/metadata'
import { Skeleton } from '@/components/ui/skeleton'

const RoutineJobRouteMap = dynamic(
  () => import('@/components/jobs/RoutineJobRouteMap').then(m => m.RoutineJobRouteMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-slate-900" /> },
)

export default function RoutineJobsPage() {
  const { data: session } = useSession()
  const api = useMemo(() => createClientApiClient(session?.accessToken), [session?.accessToken])
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)

  const zonesQuery = useQuery({
    queryKey: ['routine', 'zones', session?.accessToken],
    queryFn:  () => listZones(api),
    staleTime: 60_000,
  })

  const clustersQuery = useQuery({
    queryKey: ['routine', 'clusters', selectedZoneId, session?.accessToken],
    queryFn:  () => listClusters(api, selectedZoneId!),
    enabled:  selectedZoneId !== null,
    staleTime: 60_000,
  })

  const zones    = zonesQuery.data    ?? []
  const clusters = clustersQuery.data ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="shrink-0 px-8 py-6 border-b border-border">
        <h2 className="text-2xl font-semibold tracking-tight">Routine Jobs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Zone-based collection routes — depot to all clusters and back.
        </p>
      </div>

      {/* Content: sidebar + map */}
      <div className="flex flex-1 min-h-0">

        {/* Zone list sidebar */}
        <aside className="w-80 shrink-0 border-r border-border overflow-y-auto">
          <div className="p-4">
            <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              City Zones
            </p>

            {zonesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : zonesQuery.isError ? (
              <p className="text-xs text-red-500 px-1">Failed to load zones.</p>
            ) : zones.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">No zones found.</p>
            ) : (
              <div className="space-y-1.5">
                {zones.map((zone) => {
                  const active = zone.id === selectedZoneId
                  const clusterCount = active && clustersQuery.isSuccess ? clusters.length : null

                  return (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={[
                        'group w-full text-left rounded-xl px-4 py-3 transition-all duration-200 border',
                        active
                          ? 'bg-emerald-50/80 border-emerald-200 shadow-sm dark:bg-emerald-500/10 dark:border-emerald-700/40'
                          : 'bg-background border-border hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {zone.name}
                        </span>
                        {zone.code && (
                          <span className="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {zone.code}
                          </span>
                        )}
                      </div>

                      {active && clustersQuery.isLoading && (
                        <p className="mt-0.5 text-xs text-emerald-500 flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full border border-emerald-500 border-t-transparent animate-spin inline-block" />
                          Loading clusters…
                        </p>
                      )}
                      {clusterCount !== null && (
                        <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {clusterCount} {clusterCount === 1 ? 'cluster' : 'clusters'}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Map panel */}
        <div className="flex-1 min-h-0 relative bg-slate-50 dark:bg-slate-950">
          {selectedZoneId === null ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
              <MapPin className="h-12 w-12 opacity-15" />
              <p className="text-sm font-medium">Select a zone to view its collection route</p>
              <p className="text-xs opacity-60">Depot → clusters → depot</p>
            </div>
          ) : clustersQuery.isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="h-9 w-9 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          ) : clustersQuery.isError ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <p className="text-sm">Failed to load clusters for this zone.</p>
            </div>
          ) : clusters.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Layers className="h-10 w-10 opacity-15" />
              <p className="text-sm">No clusters found in this zone.</p>
            </div>
          ) : (
            <RoutineJobRouteMap clusters={clusters} className="h-full w-full" />
          )}
        </div>

      </div>
    </div>
  )
}
