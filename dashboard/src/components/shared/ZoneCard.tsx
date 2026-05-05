'use client'

import { useEffect, useState } from 'react'
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
  const [isPulsing, setIsPulsing] = useState(false)
  const urgentTotal = zone.urgent_bin_count + zone.critical_bin_count
  const fillPct     = Math.round(zone.avg_fill_level_pct)

  // Trigger pulse animation when core data changes
  useEffect(() => {
    setIsPulsing(true)
    const timer = setTimeout(() => setIsPulsing(false), 1000)
    return () => clearTimeout(timer)
  }, [zone.avg_fill_level_pct, zone.total_bins, urgentTotal])

  const fillColor =
    fillPct >= 80 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' :
    fillPct >= 60 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' :
    fillPct >= 40 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                    'bg-slate-400 dark:bg-slate-500'

  const inner = (
    <Card className={cn(
      'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60 dark:bg-slate-950/70',
      urgentTotal > 0 && 'border-rose-200 dark:border-rose-900/50',
      isPulsing && 'ring-1 ring-emerald-500/20 dark:ring-emerald-400/20',
    )}>
      {/* Accent Gradient Header */}
      <div className={cn(
        'absolute left-0 top-0 h-1 w-full',
        urgentTotal > 0 ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
      )} />

      <CardHeader className="pb-3 pt-5">
        <CardTitle className="flex items-center justify-between text-base font-bold tracking-tight">
          <span>{zone.zone_name}</span>
          {zone.active_jobs_count > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <span className="h-1 w-1 animate-pulse rounded-full bg-indigo-500" />
              {zone.active_jobs_count} ACTIVE
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Fill level visualization */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Avg Saturation
            </span>
            <span className={cn(
              'text-sm font-black tabular-nums transition-colors',
              fillPct >= 80 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
            )}>
              {fillPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', fillColor)}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50/50 p-2 text-center dark:bg-slate-900/50">
            <p className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{zone.total_bins}</p>
            <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">Total</p>
          </div>
          <div className={cn(
            'rounded-xl p-2 text-center',
            urgentTotal > 0 ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-slate-50/50 dark:bg-slate-900/50'
          )}>
            <p className={cn(
              'text-sm font-extrabold tabular-nums',
              urgentTotal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
            )}>
              {urgentTotal}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">Urgent</p>
          </div>
          <div className="rounded-xl bg-slate-50/50 p-2 text-center dark:bg-slate-900/50">
            <p className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {Math.round(zone.total_estimated_weight_kg)}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">Est. KG</p>
          </div>
        </div>

        {/* Live Indicator Footer */}
        {isPulsing && (
          <div className="flex justify-center pt-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 animate-pulse">
              Receiving Data
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return href ? <Link href={href} className="block no-underline">{inner}</Link> : inner
}

