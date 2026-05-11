'use client'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import type { JobProgress } from '@/types/job'

interface BinStopListProps {
  progress: JobProgress
  className?: string
}

const STATUS_ICON = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
  current:   <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />,
  pending:   <Circle className="h-4 w-4 text-muted-foreground shrink-0" />,
}

export function BinStopList({ progress, className }: BinStopListProps) {
  const { waypoints } = progress

  if (!waypoints?.length) {
    return <p className="text-sm text-muted-foreground">No stops planned.</p>
  }

  return (
    <ol className={cn('relative space-y-0', className)}>
      {waypoints.map((wp, idx) => (
        <li key={wp.cluster_id} className="flex items-start gap-3 pb-4">
          {/* Connector line */}
          <div className="relative flex flex-col items-center">
            {STATUS_ICON[wp.status]}
            {idx < waypoints.length - 1 && (
              <div className="mt-1 h-full w-0.5 bg-border" />
            )}
          </div>
          {/* Content */}
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{wp.cluster_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {wp.bins_collected_at_stop ?? 0}/{wp.bins.length} bins
              </span>
            </div>
            {wp.arrived_at && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(wp.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {wp.completed_at && (
                  <> → {new Date(wp.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                )}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
