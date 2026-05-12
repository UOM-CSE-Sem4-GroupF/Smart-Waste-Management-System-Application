'use client'
import { cn } from '@/lib/utils'

interface JobProgressBarProps {
  binsCollected: number
  binsTotal:     number
  cargoKg?:      number
  capacityKg?:   number
  className?:    string
}

export function JobProgressBar({
  binsCollected,
  binsTotal,
  cargoKg,
  capacityKg,
  className,
}: JobProgressBarProps) {
  const binPct   = binsTotal > 0 ? Math.min(100, (binsCollected / binsTotal) * 100) : 0
  const cargoPct = capacityKg && cargoKg != null
    ? Math.min(100, (cargoKg / capacityKg) * 100)
    : null

  const cargoColour =
    cargoPct == null ? '#22c55e' :
    cargoPct >= 90   ? '#ef4444' :
    cargoPct >= 70   ? '#f97316' : '#22c55e'

  return (
    <div className={cn('space-y-2', className)}>
      {/* Bins progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Bins collected</span>
          <span>{binsCollected}/{binsTotal}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${binPct}%` }}
          />
        </div>
      </div>

      {/* Cargo utilisation */}
      {cargoPct !== null && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Cargo</span>
            <span>{cargoKg?.toFixed(0)} / {capacityKg} kg</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${cargoPct}%`, backgroundColor: cargoColour }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
