'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useJobs } from '@/hooks/useJobs'
import { useJobStore } from '@/store/jobStore'
import { cancelJob } from '@/lib/api/jobs'
import { createClientApiClient } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
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

const STATE_BADGE: Record<string, string> = {
  CREATED:          'bg-blue-100 text-blue-800',
  BIN_CONFIRMING:   'bg-blue-100 text-blue-800',
  IN_PROGRESS:      'bg-green-100 text-green-800',
  COMPLETING:       'bg-green-100 text-green-800',
  DISPATCHED:       'bg-indigo-100 text-indigo-800',
  COMPLETED:        'bg-green-100 text-green-800',
  ESCALATED:        'bg-orange-100 text-orange-800',
  CANCELLED:        'bg-gray-100 text-gray-700',
  FAILED:           'bg-red-100 text-red-800',
}

function stateBadgeClass(state: string) {
  return STATE_BADGE[state] ?? 'bg-gray-100 text-gray-700'
}

function JobCard({ job, onCancel }: { job: CollectionJobListItem; onCancel?: (id: string) => void }) {
  return (
    <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className="font-medium text-green-600 hover:underline dark:text-green-400"
              >
                {job.id.slice(0, 8)}…
              </Link>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                job.job_type === 'emergency'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
              }`}>
                {job.job_type}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${stateBadgeClass(job.state)}`}>
                {job.state.replace(/_/g, ' ')}
              </span>
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
                onClick={() => onCancel(job.id)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function JobList({
  filter,
  onCancel,
}: {
  filter: { state?: string }
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
        <JobCard key={job.id} job={job} onCancel={onCancel} />
      ))}
    </div>
  )
}

export default function JobsPage() {
  const { data: session }     = useSession()
  const queryClient           = useQueryClient()
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError,  setCancelError]  = useState<string | null>(null)

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
            onCancel={(id) => { setCancelTarget(id); setCancelError(null) }}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <JobList filter={{ state: COMPLETED_STATES.join(',') }} />
        </TabsContent>

        <TabsContent value="escalated" className="mt-4">
          <JobList filter={{ state: ESCALATED_STATES.join(',') }} />
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          <JobList filter={{ state: CANCELLED_STATES.join(',') }} />
        </TabsContent>
      </Tabs>

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
