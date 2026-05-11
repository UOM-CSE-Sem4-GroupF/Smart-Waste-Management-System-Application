import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?:  'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const SIZE_CLASSES = {
  sm:  'h-4 w-4 border-2',
  md:  'h-8 w-8 border-2',
  lg:  'h-12 w-12 border-3',
}

export function LoadingSpinner({ size = 'md', label, className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-muted border-t-emerald-500',
          SIZE_CLASSES[size],
        )}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && (
        <p className="text-xs text-muted-foreground">{label}</p>
      )}
    </div>
  )
}
