import { cn } from '@/lib/utils'
import type { BinStatus } from '@/types'

const STATUS_STYLES: Record<BinStatus, string> = {
  normal:   'bg-green-100  text-green-800  dark:bg-green-950/40  dark:text-green-400',
  monitor:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
  urgent:   'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400',
  critical: 'bg-red-100    text-red-800    dark:bg-red-950/40    dark:text-red-400',
  offline:  'bg-gray-100   text-gray-600   dark:bg-gray-800/40   dark:text-gray-400',
}

interface BinStatusBadgeProps {
  status: BinStatus
  className?: string
}

export function BinStatusBadge({ status, className }: BinStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  )
}
