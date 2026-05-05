import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ZoneStatsPayload } from '@/types'

interface ZoneCardProps {
  zone: ZoneStatsPayload
  /** Link destination — defaults to no link */
  href?: string
}

export function ZoneCard({ zone, href }: ZoneCardProps) {
  const urgentTotal = zone.urgent_bin_count + zone.critical_bin_count
  const fillPct     = Math.round(zone.avg_fill_level_pct)

  const fillColor =
    fillPct >= 80 ? 'bg-[var(--color-bin-critical)]' :
    fillPct >= 60 ? 'bg-[var(--color-bin-urgent)]' :
    fillPct >= 40 ? 'bg-[var(--color-bin-monitor)]' :
                    'bg-[var(--color-bin-normal)]'

  const inner = (
    <Card className={cn(
      'rounded-xl shadow-sm transition-shadow hover:shadow-md',
      urgentTotal > 0 && 'border-orange-200 dark:border-orange-900',
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{zone.zone_name}</span>
          {zone.active_jobs_count > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
              {zone.active_jobs_count} job{zone.active_jobs_count !== 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Fill level bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Avg fill</span>
            <span className="font-medium tabular-nums">{fillPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', fillColor)}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{zone.total_bins}</p>
            <p className="text-xs text-muted-foreground">Bins</p>
          </div>
          <div>
            <p className={cn('text-lg font-bold tabular-nums', urgentTotal > 0 ? 'text-red-600 dark:text-red-400' : '')}>
              {urgentTotal}
            </p>
            <p className="text-xs text-muted-foreground">Urgent</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">
              {Math.round(zone.total_estimated_weight_kg)}
            </p>
            <p className="text-xs text-muted-foreground">kg est.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return href ? <Link href={href} className="block">{inner}</Link> : inner
}
