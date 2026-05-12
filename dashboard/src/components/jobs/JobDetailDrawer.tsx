'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Truck, User, Package } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { JobStateBadge } from './JobStateBadge'
import { JobTypeBadge } from './JobTypeBadge'
import { JobProgressBar } from './JobProgressBar'
import { BinStopList } from './BinStopList'
import { StateTimeline, StateTransition } from './StateTimeline'
import { createClientApiClient } from '@/lib/api-client'
import { getJob } from '@/lib/api/jobs'
import { getJobProgress } from '@/lib/api/jobs'
import { formatDistanceToNow } from 'date-fns'
import type { CollectionJobDetail } from '@/types'

interface JobDetailDrawerProps {
  jobId:   string | null
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-xs text-right">{value ?? '—'}</span>
    </div>
  )
}

export function JobDetailDrawer({ jobId, onClose }: JobDetailDrawerProps) {
  const { data: session } = useSession()
  const open = !!jobId

  const { data: restJob, isLoading: jobLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(createClientApiClient(session?.accessToken), jobId!),
    enabled: !!jobId,
    staleTime: 30_000,
  })

  const job = restJob ?? null

  const { data: progress } = useQuery({
    queryKey: ['job-progress', jobId],
    queryFn: () => getJobProgress(createClientApiClient(session?.accessToken), jobId!),
    enabled: !!jobId && !!session?.accessToken,
    staleTime: 15_000,
    retry: false,
  })

  // Build timeline from step_log if available
  const timeline: StateTransition[] = (job as CollectionJobDetail)?.step_log
    ?.filter((s) => s.success)
    .map((s) => ({ state: s.step_name.toUpperCase(), entered_at: s.executed_at })) ?? []

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle className="text-base font-semibold">Job Detail</DialogTitle>
          {job && (
            <div className="mt-1 flex flex-wrap gap-2">
              <JobStateBadge state={job.state} />
              <JobTypeBadge type={job.job_type.toUpperCase()} />
              <span className="text-xs text-muted-foreground font-mono">
                {job.job_id.slice(0, 8)}…
              </span>
            </div>
          )}
        </DialogHeader>

        {jobLoading ? (
          <div className="flex-1 px-6 py-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !job ? (
          <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
            Job not found.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="px-6 pb-6 space-y-5">
              {/* Progress bar */}
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

              {/* Summary rows */}
              <div>
                <DetailRow label="Zone" value={job.zone_name ?? `Zone ${job.zone_id}`} />
                <DetailRow
                  label="Vehicle"
                  value={
                    job.assigned_vehicle_id ? (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {job.assigned_vehicle_id}
                      </span>
                    ) : null
                  }
                />
                <DetailRow
                  label="Driver"
                  value={
                    job.assigned_driver_id ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {job.assigned_driver_id}
                      </span>
                    ) : null
                  }
                />
                <DetailRow label="Bins total" value={job.bins_total ?? job.bins_to_collect?.length ?? 0} />
                <DetailRow label="Bins collected" value={job.bins_collected ?? 0} />
                <DetailRow
                  label="Planned weight"
                  value={job.planned_weight_kg ? `${job.planned_weight_kg} kg` : null}
                />
                <DetailRow
                  label="Actual weight"
                  value={job.actual_weight_kg ? `${job.actual_weight_kg} kg` : null}
                />
                <DetailRow
                  label="Created"
                  value={formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                />
                {job.completed_at && (
                  <DetailRow
                    label="Completed"
                    value={new Date(job.completed_at).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  />
                )}
                {(job as CollectionJobDetail).hyperledger_tx_id && (
                  <DetailRow
                    label="Audit TX"
                    value={
                      <span className="font-mono text-xs truncate max-w-45 block">
                        {(job as CollectionJobDetail).hyperledger_tx_id}
                      </span>
                    }
                  />
                )}
                {(job as CollectionJobDetail).failure_reason && (
                  <DetailRow
                    label="Failure reason"
                    value={
                      <span className="text-red-500">
                        {(job as CollectionJobDetail).failure_reason}
                      </span>
                    }
                  />
                )}
              </div>

              <Separator />

              {/* Tabs: Stops | Timeline */}
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
                    : <p className="text-sm text-muted-foreground">No state history.</p>
                  }
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
