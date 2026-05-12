'use client'

import { Badge } from '@/components/ui/badge'
import type { BinStatus } from '@/types/bin'

interface StatusBadgeProps {
  status: BinStatus
  size?:  'sm' | 'md'
}

const STATUS_STYLES: Record<BinStatus, string> = {
  normal:   'bg-green-100  text-green-800  dark:bg-green-950/40  dark:text-green-400',
  monitor:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
  urgent:   'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400',
  critical: 'bg-red-100    text-red-800    dark:bg-red-950/40    dark:text-red-400',
  offline:  'bg-gray-100   text-gray-600   dark:bg-gray-900/40   dark:text-gray-400',
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent font-medium capitalize ${STATUS_STYLES[status]} ${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}`}
    >
      {status}
    </Badge>
  )
}
