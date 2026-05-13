'use client'

import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Truck, User, MapPin, Package, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { JobStateBadge } from './JobStateBadge'
import { JobTypeBadge } from './JobTypeBadge'
import { JobProgressBar } from './JobProgressBar'
import { BinStopList } from './BinStopList'
import { StateTimeline, StateTransition } from './StateTimeline'
import type { RouteStop } from './JobRouteMap'
import { createClientApiClient } from '@/lib/api-client'
import { getJob, getJobProgress } from '@/lib/api/jobs'
import { formatDistanceToNow } from 'date-fns'
import type { CollectionJobDetail } from '@/types'

const JobRouteMap = dynamic(
  () => import('./JobRouteMap').then(m => ({ default: m.JobRouteMap })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-lg" /> },
)

interface Props {
  jobId:   string
  onClose: () => void
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-xs text-right break-all">{value ?? '—'}</span>
    </div>
  )
}

export function JobDetailPanel({ jobId, onClose }: Props) {
  const { data: session } = useSession()
  const api = createClientApiClient(session?.accessToken)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn:  () => getJob(api, jobId),
    enabled:  !!jobId,
    staleTime: 30_000,
  })

  const { data: progress } = useQuery({
    queryKey: ['job-progress', jobId],
    queryFn:  () => getJobProgress(api, jobId),
    enabled:  !!jobId,
    staleTime: 15_000,
    retry: false,
  })

  // Build route stops from progress waypoints (lat/lng provided by scheduler clusterCoordinates)
  const routeStops: RouteStop[] = (progress?.waypoints ?? [])
    .filter(w => w.lat && w.lng)
    .map(w => ({
      sequence:     w.sequence,
      cluster_id:   w.cluster_id,
      cluster_name: w.cluster_name,
      lat:          w.lat as number,
      lng:          w.lng as number,
      status:       w.status,
    }))

  const hasRoute = routeStops.length > 0

  const timeline: StateTransition[] = (job as CollectionJobDetail)?.step_log
    ?.filter(s => s.success)
    .map(s => ({ state: s.step_name.toUpperCase(), entered_at: s.executed_at })) ?? []

  return (
    <div className="flex h-full flex-col bg-background border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {job && <JobStateBadge state={job.state} />}
            {job && <JobTypeBadge type={job.job_type.toUpperCase()} />}
            <span className="text-xs font-mono text-muted-foreground">{jobId.slice(0, 8)}…</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {job?.zone_name ?? (job ? `Zone ${job.zone_id}` : '…')}
            {job?.priority != null ? ` · Priority ${job.priority}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 mt-0.5" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 pb-6 pt-4 space-y-4">

          {/* Route map */}
          {isLoading && !hasRoute ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : hasRoute ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Route</p>
                <span className="text-[10px] text-muted-foreground">
                  OSRM road network · {routeStops.length} stops
                </span>
              </div>
              <JobRouteMap
                stops={routeStops}
                polyline={null}
                className="h-64 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
              />
            </div>
          ) : null}

          {/* Progress */}
          {progress && (
            <>
              <JobProgressBar
                binsCollected={progress.bins_collected}
                binsTotal={progress.total_bins}
                cargoKg={progress.cargo_weight_kg}
                capacityKg={progress.cargo_limit_kg}
              />
              <Separator />
            </>
          )}

          {/* Detail rows */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : job ? (
            <div>
              <Row label="Zone"    value={job.zone_name ?? `Zone ${job.zone_id}`} />
              <Row label="Vehicle" value={job.assigned_vehicle_id
                ? <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{job.assigned_vehicle_id}</span>
                : null}
              />
              <Row label="Driver"  value={job.assigned_driver_id
                ? <span className="flex items-center gap-1"><User className="h-3 w-3" />{job.assigned_driver_id}</span>
                : null}
              />
              <Row label="Bins total"     value={job.bins_total ?? job.bins_to_collect?.length ?? 0} />
              <Row label="Bins collected" value={job.bins_collected ?? 0} />
              <Row label="Planned weight" value={job.planned_weight_kg ? `${job.planned_weight_kg} kg` : null} />
              <Row label="Actual weight"  value={job.actual_weight_kg  ? `${job.actual_weight_kg} kg`  : null} />
              {(job as CollectionJobDetail).planned_distance_km && (
                <Row label="Distance" value={`${(job as CollectionJobDetail).planned_distance_km} km`} />
              )}
              <Row label="Created" value={formatDistanceToNow(new Date(job.created_at), { addSuffix: true })} />
              {job.completed_at && (
                <Row label="Completed" value={new Date(job.completed_at).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })} />
              )}
              {(job as CollectionJobDetail).hyperledger_tx_id && (
                <Row label="Audit TX" value={
                  <span className="font-mono text-[10px] break-all">{(job as CollectionJobDetail).hyperledger_tx_id}</span>
                } />
              )}
              {(job as CollectionJobDetail).failure_reason && (
                <Row label="Failure reason" value={
                  <span className="text-red-500">{(job as CollectionJobDetail).failure_reason}</span>
                } />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Job not found.</p>
          )}

          <Separator />

          {/* Stops + Timeline tabs */}
          <Tabs defaultValue="stops">
            <TabsList className="w-full">
              <TabsTrigger value="stops" className="flex-1">
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Stops
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1">
                <Package className="mr-1.5 h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stops" className="pt-4">
              {progress
                ? <BinStopList progress={progress} />
                : <p className="text-sm text-muted-foreground">Progress data unavailable.</p>
              }
            </TabsContent>
            <TabsContent value="timeline" className="pt-4">
              {timeline.length > 0
                ? <StateTimeline transitions={timeline} />
                : <p className="text-sm text-muted-foreground">No state history yet.</p>
              }
            </TabsContent>
          </Tabs>

        </div>
      </ScrollArea>
    </div>
  )
}
