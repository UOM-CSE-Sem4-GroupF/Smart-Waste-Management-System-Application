'use client'
import { cn } from '@/lib/utils'

interface JobTypeBadgeProps {
  type: string
  className?: string
}

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  SCHEDULED:  { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300' },
  EMERGENCY:  { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-300' },
  SPECIAL:    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
}

export function JobTypeBadge({ type, className }: JobTypeBadgeProps) {
  const style = TYPE_STYLE[type] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        style.bg, style.text, className,
      )}
    >
      {type}
    </span>
  )
}
