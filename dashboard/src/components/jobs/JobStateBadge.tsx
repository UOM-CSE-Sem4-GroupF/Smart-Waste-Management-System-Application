'use client'
import { cn } from '@/lib/utils'
import { JOB_STATE_COLOURS } from '@/lib/colours'

interface JobStateBadgeProps {
  state: string
  className?: string
}

const STATE_LABEL: Record<string, string> = {
  CREATED:             'Created',
  BIN_CONFIRMING:      'Bin Confirming',
  BIN_CONFIRMED:       'Bin Confirmed',
  CLUSTER_ASSEMBLING:  'Assembling',
  CLUSTER_ASSEMBLED:   'Assembled',
  DISPATCHING:         'Dispatching',
  DISPATCHED:          'Dispatched',
  DRIVER_NOTIFIED:     'Notified',
  IN_PROGRESS:         'In Progress',
  COMPLETING:          'Completing',
  COLLECTION_DONE:     'Done',
  RECORDING_AUDIT:     'Auditing',
  COMPLETED:           'Completed',
  ESCALATED:           'Escalated',
  CANCELLED:           'Cancelled',
  FAILED:              'Failed',
}

export function JobStateBadge({ state, className }: JobStateBadgeProps) {
  const colour = JOB_STATE_COLOURS[state] ?? '#6B7280'
  const label  = STATE_LABEL[state] ?? state

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
      style={{ backgroundColor: `${colour}22`, color: colour, border: `1px solid ${colour}44` }}
    >
      {label}
    </span>
  )
}
