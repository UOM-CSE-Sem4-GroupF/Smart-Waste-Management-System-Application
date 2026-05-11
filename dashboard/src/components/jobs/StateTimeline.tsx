'use client'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { JobStateBadge } from './JobStateBadge'

export interface StateTransition {
  state:      string
  entered_at: string
}

interface StateTimelineProps {
  transitions: StateTransition[]
  className?:  string
}

const TERMINAL_STATES = new Set(['COMPLETED', 'CANCELLED', 'FAILED'])

export function StateTimeline({ transitions, className }: StateTimelineProps) {
  if (!transitions?.length) {
    return <p className="text-sm text-muted-foreground">No state history.</p>
  }

  return (
    <ol className={cn('relative space-y-0', className)}>
      {transitions.map((t, idx) => {
        const isLast   = idx === transitions.length - 1
        const isFinal  = TERMINAL_STATES.has(t.state)
        const isError  = t.state === 'FAILED' || t.state === 'ESCALATED'

        return (
          <li key={idx} className="flex items-start gap-3 pb-4">
            {/* Icon + connector */}
            <div className="relative flex flex-col items-center">
              {isError
                ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                : isFinal
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              {!isLast && (
                <div className="mt-1 h-full min-h-6 w-0.5 bg-border" />
              )}
            </div>
            {/* Text */}
            <div className="flex-1 pb-1">
              <JobStateBadge state={t.state} />
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(t.entered_at).toLocaleString([], {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
