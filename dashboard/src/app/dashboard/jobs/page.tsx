'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useJobs } from '@/hooks/useJobs'
import { cancelJob } from '@/lib/api/jobs'
import { createClientApiClient } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { JobStateBadge } from '@/components/jobs/JobStateBadge'
import { JobTypeBadge } from '@/components/jobs/JobTypeBadge'
import { JobProgressBar } from '@/components/jobs/JobProgressBar'
import { JobDetailDrawer } from '@/components/jobs/JobDetailDrawer'
import type { CollectionJobListItem, JobState } from '@/types'

const ACTIVE_STATES: JobState[] = [
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT',
]
const COMPLETED_STATES: JobState[] = ['COMPLETED', 'AUDIT_RECORDED']
const ESCALATED_STATES: JobState[] = ['ESCALATED']
const CANCELLED_STATES: JobState[] = ['CANCELLED', 'FAILED', 'AUDIT_FAILED']

function JobCard({
  job,
  onSelect,
  onCancel,
}: {
  job:       CollectionJobListItem
  onSelect?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  return (
    <Card
      className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(job.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm font-mono">{job.id.slice(0, 8)}…</span>
              <JobTypeBadge type={job.job_type.toUpperCase()} />
              <JobStateBadge state={job.state} />
            </div>
            <p className="text-xs text-muted-foreground">
              {job.zone_name} · Priority {job.priority} ·{' '}
              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </p>
            <p className="text-xs text-muted-foreground">
              Driver: {job.assigned_driver_id ?? '—'} · Vehicle: {job.assigned_vehicle_id ?? '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
            <span>{job.bins_collected}/{job.bins_total} bins</span>
            {job.planned_weight_kg != null && (
              <span>{job.planned_weight_kg.toFixed(0)} kg planned</span>
            )}
            {onCancel && ACTIVE_STATES.includes(job.state) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => { e.stopPropagation(); onCancel(job.id) }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
        {/* Inline progress bar for active jobs */}
        {ACTIVE_STATES.includes(job.state) && (
          <JobProgressBar
            binsCollected={job.bins_collected}
            binsTotal={job.bins_total}
            cargoKg={job.actual_weight_kg ?? undefined}
            capacityKg={job.planned_weight_kg ?? undefined}
          />
        )}
      </CardContent>
    </Card>
  )
}

function JobList({
  filter,
  onSelect,
  onCancel,
}: {
  filter:    { state?: string }
  onSelect?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  const { data, isLoading } = useJobs({ state: filter.state, limit: 50 })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const jobs = data?.data ?? []
  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No jobs in this category.</p>
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onSelect={onSelect} onCancel={onCancel} />
      ))}
    </div>
  )
}

export default function JobsPage() {
  const { data: session }     = useSession()
  const queryClient           = useQueryClient()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget]   = useState<string | null>(null)
  const [cancelReason, setCancelReason]   = useState('')
  const [cancelError,  setCancelError]    = useState<string | null>(null)

  const { mutate: doCancel, isPending } = useMutation({
    mutationFn: (jobId: string) =>
      cancelJob(createClientApiClient(session!.accessToken), jobId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setCancelTarget(null)
      setCancelReason('')
      setCancelError(null)
    },
    onError: (e: Error) => setCancelError(e.message),
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Collection Jobs</h2>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="escalated">Escalated</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <JobList
            filter={{ state: ACTIVE_STATES.join(',') }}
            onSelect={setSelectedJobId}
            onCancel={(id) => { setCancelTarget(id); setCancelError(null) }}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <JobList filter={{ state: COMPLETED_STATES.join(',') }} onSelect={setSelectedJobId} />
        </TabsContent>

        <TabsContent value="escalated" className="mt-4">
          <JobList filter={{ state: ESCALATED_STATES.join(',') }} onSelect={setSelectedJobId} />
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          <JobList filter={{ state: CANCELLED_STATES.join(',') }} onSelect={setSelectedJobId} />
        </TabsContent>
      </Tabs>

      {/* Detail drawer */}
      <JobDetailDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel job?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will cancel job <span className="font-medium">{cancelTarget?.slice(0, 8)}…</span>.
              Provide a reason below.
            </p>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              rows={3}
              placeholder="Reason for cancellation…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            {cancelError && (
              <p className="text-xs text-red-600">{cancelError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep job</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || isPending}
              onClick={() => cancelTarget && doCancel(cancelTarget)}
            >
              {isPending ? 'Cancelling…' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}



