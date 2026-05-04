'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { JobStateBadge } from './JobStateBadge'
import { JobTypeBadge } from './JobTypeBadge'
import { JobStateStepper } from './JobStateStepper'
import { getJob, cancelJob } from '@/lib/api/jobs'
import { createClientApiClient } from '@/lib/api-client'
import type { CollectionJobDetail } from '@/types'

interface JobDetailDrawerProps {
  jobId:     string | null
  open:      boolean
  onClose:   () => void
  onCancelled?: () => void
}

export function JobDetailDrawer({ jobId, open, onClose, onCancelled }: JobDetailDrawerProps) {
  const { data: session } = useSession()
  const isSupervisor = ['supervisor', 'admin'].includes(session?.user?.role ?? '')
  const queryClient  = useQueryClient()
  const [copied, setCopied]       = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel]     = useState(false)

  const { data: job, isLoading } = useQuery<CollectionJobDetail>({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const api = createClientApiClient(session!.accessToken)
      return getJob(api, jobId!)
    },
    enabled: open && !!jobId && !!session?.accessToken,
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const api = createClientApiClient(session!.accessToken)
      return cancelJob(api, jobId!, cancelReason)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      setShowCancel(false)
      setCancelReason('')
      onCancelled?.()
    },
  })

  const copyTx = () => {
    if (!job?.hyperledger_tx_id) return
    navigator.clipboard.writeText(job.hyperledger_tx_id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isTerminal = job && ['COMPLETED', 'CANCELLED', 'FAILED', 'AUDIT_RECORDED', 'ESCALATED'].includes(job.state)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          {isLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : job ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <JobTypeBadge type={job.job_type} />
                <JobStateBadge state={job.state} />
                {isSupervisor && !isTerminal && !showCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                    onClick={() => setShowCancel(true)}
                  >
                    Cancel job
                  </Button>
                )}
              </div>
              <SheetTitle className="text-base">
                {job.zone_name}
              </SheetTitle>
              <p className="text-xs font-mono text-muted-foreground">{job.id}</p>
            </div>
          ) : null}
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="px-6 py-4 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : job ? (
            <div className="px-6 py-4 space-y-6">

              {/* Cancel confirm */}
              {showCancel && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3 dark:border-red-900 dark:bg-red-950/20">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Cancel job?</p>
                  <input
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Reason (optional)"
                    value={cancelReason}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCancelReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-3 text-xs"
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? 'Cancelling…' : 'Confirm cancel'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs"
                      onClick={() => setShowCancel(false)}
                    >
                      Keep job
                    </Button>
                  </div>
                </div>
              )}

              {/* Assignment */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment</h3>
                <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Vehicle</span>
                  <span className="font-medium">{job.assigned_vehicle_id ?? '—'}</span>
                  <span className="text-muted-foreground">Driver</span>
                  <span className="font-medium">{job.assigned_driver_id ?? '—'}</span>
                  <span className="text-muted-foreground">Route plan</span>
                  <span className="font-mono text-xs">{job.route_plan_id ?? '—'}</span>
                </div>
              </section>

              <Separator />

              {/* Weight */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight</h3>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Planned</span>
                    <span>{job.planned_weight_kg != null ? `${job.planned_weight_kg.toFixed(1)} kg` : '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actual</span>
                    <span className="font-medium">{job.actual_weight_kg != null ? `${job.actual_weight_kg.toFixed(1)} kg` : '—'}</span>
                  </div>
                  {job.planned_weight_kg && job.actual_weight_kg && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min((job.actual_weight_kg / job.planned_weight_kg) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* Bin stops */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bin stops</h3>
                {job.bin_collections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bin data available</p>
                ) : (
                  <ol className="space-y-1">
                    {job.bin_collections
                      .sort((a, b) => a.sequence_number - b.sequence_number)
                      .map((bc) => (
                        <li key={bc.bin_id} className="flex items-center gap-2 text-sm">
                          <span className="text-base">
                            {bc.status === 'collected' ? '✅' : bc.status === 'skipped' ? '⏭️' : '⏳'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground w-20">{bc.bin_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {bc.fill_level_at_collection != null
                              ? `${bc.fill_level_at_collection.toFixed(0)}% fill`
                              : bc.status}
                          </span>
                          {bc.skip_reason && (
                            <span className="text-xs text-orange-500 ml-auto">{bc.skip_reason}</span>
                          )}
                        </li>
                      ))}
                  </ol>
                )}
              </section>

              <Separator />

              {/* State timeline */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State timeline</h3>
                <JobStateStepper state={job.state} />
                {job.state_history.length > 0 && (
                  <ol className="mt-3 space-y-1 border-l-2 border-border pl-4">
                    {job.state_history.map((h, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium">{h.to_state}</span>
                        <span className="text-muted-foreground ml-2">
                          {format(new Date(h.transitioned_at), 'HH:mm:ss')}
                        </span>
                        {h.reason && <span className="text-muted-foreground ml-1">— {h.reason}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Blockchain TX (completed) */}
              {job.hyperledger_tx_id && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blockchain TX</h3>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                        {job.hyperledger_tx_id}
                      </code>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={copyTx}>
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </section>
                </>
              )}

              {/* Failure reason */}
              {job.failure_reason && (
                <>
                  <Separator />
                  <section className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600">Failure reason</h3>
                    <p className="text-sm text-red-700 dark:text-red-400">{job.failure_reason}</p>
                  </section>
                </>
              )}
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">Job not found.</p>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
