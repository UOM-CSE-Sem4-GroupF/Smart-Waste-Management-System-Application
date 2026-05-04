'use client'

import { formatDistanceToNow } from 'date-fns'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JobStateBadge, JOB_STATE_COLOURS } from './JobStateBadge'
import { JobTypeBadge } from './JobTypeBadge'
import type { CollectionJobListItem } from '@/types'

interface ActiveJobCardProps {
  job:          CollectionJobListItem
  onViewDetail: (id: string) => void
  onCancel:     (id: string) => void
}

export function ActiveJobCard({ job, onViewDetail, onCancel }: ActiveJobCardProps) {
  const { data: session } = useSession()
  const isSupervisor = ['supervisor', 'admin'].includes(session?.user?.role ?? '')

  const borderColour = JOB_STATE_COLOURS[job.state] ?? '#6B7280'
  const binPct  = job.bins_total > 0 ? (job.bins_collected / job.bins_total) * 100 : 0
  const weightPct =
    job.planned_weight_kg && job.actual_weight_kg
      ? Math.min((job.actual_weight_kg / job.planned_weight_kg) * 100, 100)
      : 0

  return (
    <Card
      className="rounded-xl shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColour }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono text-muted-foreground truncate">{job.id}</p>
            <p className="text-sm font-semibold mt-0.5">{job.zone_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <JobTypeBadge type={job.job_type} />
            <JobStateBadge state={job.state} />
          </div>
        </div>

        {/* Assignment */}
        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <span>Vehicle: <span className="text-foreground font-medium">{job.assigned_vehicle_id ?? '—'}</span></span>
          <span>Driver: <span className="text-foreground font-medium">{job.assigned_driver_id ?? '—'}</span></span>
        </div>

        {/* Bins progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Bins collected</span>
            <span>{job.bins_collected} / {job.bins_total}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${binPct}%`, backgroundColor: borderColour }}
            />
          </div>
        </div>

        {/* Cargo progress */}
        {job.planned_weight_kg && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cargo weight</span>
              <span>
                {job.actual_weight_kg != null ? `${job.actual_weight_kg.toFixed(0)} kg` : '—'}{' '}
                / {job.planned_weight_kg.toFixed(0)} kg
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${weightPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </span>
          <div className="flex gap-2">
            {isSupervisor && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                onClick={() => onCancel(job.id)}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onViewDetail(job.id)}
            >
              View details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
