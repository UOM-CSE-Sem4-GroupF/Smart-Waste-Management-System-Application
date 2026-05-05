import type { JobType } from '@/types'

interface JobTypeBadgeProps {
  type: JobType
  className?: string
}

export function JobTypeBadge({ type, className = '' }: JobTypeBadgeProps) {
  const isEmergency = type === 'emergency'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        isEmergency
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
      } ${className}`}
    >
      {isEmergency ? 'Emergency' : 'Routine'}
    </span>
  )
}
