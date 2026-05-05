'use client'

import { cn } from '@/lib/utils'

interface Props {
  size?:      'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
}

export function LoadingSpinner({ size = 'md', className }: Props) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'animate-spin rounded-full border-current border-t-transparent',
        SIZE_CLASSES[size],
        className,
      )}
    />
  )
}
