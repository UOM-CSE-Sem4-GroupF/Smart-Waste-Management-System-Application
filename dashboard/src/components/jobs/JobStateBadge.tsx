export const JOB_STATE_COLOURS: Record<string, string> = {
  CREATED:            '#6B7280',
  BIN_CONFIRMING:     '#8B5CF6',
  BIN_CONFIRMED:      '#8B5CF6',
  CLUSTER_ASSEMBLING: '#8B5CF6',
  CLUSTER_ASSEMBLED:  '#8B5CF6',
  DISPATCHING:        '#3B82F6',
  DISPATCHED:         '#3B82F6',
  DRIVER_NOTIFIED:    '#EAB308',
  IN_PROGRESS:        '#22C55E',
  COMPLETING:         '#22C55E',
  COLLECTION_DONE:    '#10B981',
  COMPLETED:          '#6B7280',
  ESCALATED:          '#EF4444',
  FAILED:             '#EF4444',
  CANCELLED:          '#6B7280',
}

interface JobStateBadgeProps {
  state: string
  className?: string
}

export function JobStateBadge({ state, className = '' }: JobStateBadgeProps) {
  const colour = JOB_STATE_COLOURS[state] ?? '#6B7280'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
      style={{ backgroundColor: `${colour}20`, color: colour, borderColor: `${colour}40`, border: '1px solid' }}
    >
      {state.replace(/_/g, ' ')}
    </span>
  )
}
