'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useJobs } from '@/hooks/useJobs'
import { useJobStore } from '@/store/jobStore'
import { cancelJob, createJob } from '@/lib/api/jobs'
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
  // Fallback: use the store list seeded by MockSocketInjector when REST is unavailable
  const storeJobsList = useJobStore((s) => s.jobsList)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const stateSet = filter.state ? new Set(filter.state.split(',')) : null
  const restJobs = data?.data ?? []
  const jobs = restJobs.length > 0
    ? restJobs
    : storeJobsList.filter((j) => !stateSet || stateSet.has(j.state))

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

const WASTE_CATEGORIES = [
  'general', 'paper', 'plastic', 'glass', 'food_waste', 'e_waste', 'hazardous',
]

export default function JobsPage() {
  const { data: session }     = useSession()
  const queryClient           = useQueryClient()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget]   = useState<string | null>(null)
  const [cancelReason, setCancelReason]   = useState('')
  const [cancelError,  setCancelError]    = useState<string | null>(null)

  // Create job dialog state
  const [createOpen,    setCreateOpen]    = useState(false)
  const [createJobType, setCreateJobType] = useState<'emergency' | 'routine'>('emergency')
  const [createZone,    setCreateZone]    = useState('')
  const [createCategory,setCreateCategory] = useState('general')
  const [createUrgency, setCreateUrgency] = useState(85)
  const [createBinIds,  setCreateBinIds]  = useState('')
  const [createError,   setCreateError]   = useState<string | null>(null)

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

  const { mutate: doCreate, isPending: isCreating } = useMutation({
    mutationFn: () => {
      const bin_ids = createBinIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      return createJob({
        job_type:       createJobType,
        zone_id:        createZone.trim(),
        waste_category: createCategory,
        urgency_score:  createJobType === 'emergency' ? createUrgency : undefined,
        bin_ids:        bin_ids.length > 0 ? bin_ids : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setCreateOpen(false)
      setCreateZone('')
      setCreateBinIds('')
      setCreateError(null)
    },
    onError: (e: Error) => setCreateError(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Collection Jobs</h2>
          <p className="text-sm text-muted-foreground mt-1">Track active, completed and escalated collection jobs.</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setCreateError(null) }}>
          + New Job
        </Button>
      </div>

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

      {/* Create Job dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create collection job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Job type */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Job type</label>
              <div className="flex gap-2">
                {(['emergency', 'routine'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCreateJobType(t)}
                    className={`rounded-md px-3 py-1.5 text-sm capitalize border transition-colors ${
                      createJobType === t
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone ID */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Zone ID <span className="text-red-500">*</span></label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="e.g. zone-1 or 1"
                value={createZone}
                onChange={e => setCreateZone(e.target.value)}
              />
            </div>

            {/* Waste category */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Waste category</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                value={createCategory}
                onChange={e => setCreateCategory(e.target.value)}
              >
                {WASTE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Urgency score — emergency only */}
            {createJobType === 'emergency' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Urgency score (80–100)</label>
                <input
                  type="number"
                  min={80}
                  max={100}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  value={createUrgency}
                  onChange={e => setCreateUrgency(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  The job will be auto-cancelled if no bin in this zone currently has urgency ≥ 80.
                </p>
              </div>
            )}

            {/* Bin IDs (optional) */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Bin IDs <span className="text-muted-foreground">(optional, comma-separated)</span></label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="BIN-001, BIN-002"
                value={createBinIds}
                onChange={e => setCreateBinIds(e.target.value)}
              />
            </div>

            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!createZone.trim() || isCreating}
              onClick={() => doCreate()}
            >
              {isCreating ? 'Creating…' : 'Create job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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



