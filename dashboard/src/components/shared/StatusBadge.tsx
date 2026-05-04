'use client'

import { cn } from '@/lib/utils'

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface Props {
  label:     string
  variant?:  StatusVariant
  className?: string
}

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  danger:  'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  info:    'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-300',
  neutral: 'bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300',
}

export function StatusBadge({ label, variant = 'neutral', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
