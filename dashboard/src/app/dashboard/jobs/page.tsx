'use client'

import { useState, useMemo } from 'react'
import { useJobStore } from '@/store/jobStore'
import { useJobs } from '@/hooks/useJobs'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ActiveJobCard } from '@/components/jobs/ActiveJobCard'
import { CompletedJobRow } from '@/components/jobs/CompletedJobRow'
import { JobDetailDrawer } from '@/components/jobs/JobDetailDrawer'
import { cancelJob } from '@/lib/api/jobs'
import { createClientApiClient } from '@/lib/api-client'
import type { JobState } from '@/types'

const ACTIVE_STATES: JobState[] = [
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'SPLIT_JOB', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT',
]

const TERMINAL_STATES: JobState[] = [
  'COMPLETED', 'CANCELLED', 'FAILED', 'ESCALATED', 'AUDIT_RECORDED', 'AUDIT_FAILED',
]

export default function JobsPage() {
  const { data: session }  = useSession()
  const queryClient        = useQueryClient()
  const jobsMap   = useJobStore((s) => s.jobs)
  const liveJobs  = useMemo(() => Array.from(jobsMap.values()), [jobsMap])

  const [drawerJobId, setDrawerJobId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const { data: activeData, isLoading: activeLoading } = useJobs({ limit: 50 })

  const { data: completedData, isLoading: completedLoading } = useJobs({
    state: TERMINAL_STATES.join(','),
    limit: 100,
  })

  const storeJobMap = new Map(liveJobs.map((j) => [j.job_id, j]))
  const activeJobs = (activeData?.data ?? [])
    .filter((j) => ACTIVE_STATES.includes(j.state))
    .map((j) => {
      const live = storeJobMap.get(j.id)
      if (!live) return j
      return {
        ...j,
        ...(live.state != null && { state: live.state }),
        bins_collected: live.bins_collected ?? j.bins_collected,
      }
    })

  const completedJobs = completedData?.data ?? []

  const handleCancel = async (jobId: string) => {
    if (!session?.accessToken) return
    setCancellingId(jobId)
    try {
      await cancelJob(createClientApiClient(session.accessToken), jobId, '')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex h-full gap-6 p-6">
      <div className="flex w-[360px] shrink-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active jobs</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {activeLoading ? '...' : activeJobs.length}
          </span>
        </div>

        {activeLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No active jobs</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto">
            {activeJobs.map((job) => (
              <ActiveJobCard
                key={job.id}
                job={job}
                onViewDetail={setDrawerJobId}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Completed and closed</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {completedLoading ? '...' : completedJobs.length}
          </span>
        </div>

        {completedLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : completedJobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No completed jobs</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Bins</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedJobs.map((job) => (
                  <CompletedJobRow
                    key={job.id}
                    job={job}
                    onViewDetail={setDrawerJobId}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <JobDetailDrawer
        jobId={drawerJobId}
        open={drawerJobId !== null}
        onClose={() => setDrawerJobId(null)}
        onCancelled={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
      />
    </div>
  )
}
