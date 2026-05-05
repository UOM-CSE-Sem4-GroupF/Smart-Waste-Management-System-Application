import { cn } from '@/lib/utils'

interface CargoBarProps {
  /** Current cargo weight in kg */
  used:  number
  /** Maximum cargo limit in kg */
  limit: number
  /** Show weight labels. Defaults to true. */
  showLabels?: boolean
  className?: string
}

export function CargoBar({ used, limit, showLabels = true, className }: CargoBarProps) {
  const pct   = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const color =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-yellow-500' :
                'bg-green-500'

  return (
    <div className={cn('w-full space-y-1', className)}>
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(used)} kg</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
          <span>{limit} kg</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn('h-2.5 rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
