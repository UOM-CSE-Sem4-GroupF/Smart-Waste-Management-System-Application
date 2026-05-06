'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label:       string
  value:       string | number
  sublabel?:   string
  trend?:      'up' | 'down' | 'neutral'
  trendValue?: string
  urgent?:     boolean
  icon?:       React.ReactNode
  href?:       string
}

export function StatCard({ label, value, sublabel, trend, trendValue, urgent, icon, href }: StatCardProps) {
  const [isPulsing, setIsPulsing] = useState(false)

  // Trigger pulse animation when value changes (Real-time feedback)
  useEffect(() => {
    setIsPulsing(true)
    const timer = setTimeout(() => setIsPulsing(false), 1000)
    return () => clearTimeout(timer)
  }, [value])

  const trendStyles: Record<string, string> = {
    up:      'text-emerald-600 dark:text-emerald-400',
    down:    'text-rose-500 dark:text-rose-400',
    neutral: 'text-slate-500 dark:text-slate-400',
  }
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null

  const inner = (
    <Card className={cn(
      'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60 dark:bg-slate-950/70',
      urgent && 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20',
      isPulsing && 'ring-2 ring-emerald-500/30 dark:ring-emerald-400/20',
      href && 'cursor-pointer',
    )}>
      {/* Dynamic Background Glow */}
      <div className={cn(
        'absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl transition-opacity duration-1000',
        urgent ? 'bg-rose-500/10' : 'bg-emerald-500/10',
        isPulsing ? 'opacity-100' : 'opacity-40'
      )} />

      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
              </p>
              {isPulsing && (
                <span className="flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
              )}
            </div>
            <p className={cn(
              'text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50',
              urgent && 'text-rose-600 dark:text-rose-400',
              isPulsing && 'animate-[pulse_1s_ease-in-out]'
            )}>
              {value}
            </p>
          </div>
          {icon && (
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl shadow-inner transition-transform duration-500',
              urgent
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              isPulsing && 'scale-110'
            )}>
              {icon}
            </div>
          )}
        </div>
        
        {(trendValue ?? sublabel) && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800/50">
            <p className={cn('flex items-center gap-1 text-xs font-medium', trendStyles[trend ?? 'neutral'])}>
              {trendIcon && <span className="text-sm font-bold">{trendIcon}</span>}
              <span>{trendValue ?? sublabel}</span>
            </p>
            {isPulsing && (
              <span className="text-[10px] font-bold uppercase text-emerald-500 dark:text-emerald-400 animate-pulse">
                Live
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return href ? <Link href={href} className="block no-underline">{inner}</Link> : inner
}

