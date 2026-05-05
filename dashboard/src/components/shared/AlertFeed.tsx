'use client'

import { Bell, AlertTriangle, TriangleAlert, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAlertStore } from '@/store/alertStore'
import type { Alert } from '@/store/alertStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const ALERT_ICON: Record<Alert['type'], React.ElementType> = {
  urgent:        Bell,
  escalated:     AlertTriangle,
  deviation:     TriangleAlert,
  'weight-limit': TriangleAlert,
}

const ALERT_STYLE: Record<Alert['type'], string> = {
  urgent:        'border-rose-100 bg-rose-50/30 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400',
  escalated:     'border-orange-100 bg-orange-50/30 text-orange-700 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-400',
  deviation:     'border-amber-100 bg-amber-50/30 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400',
  'weight-limit': 'border-yellow-100 bg-yellow-50/30 text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-950/20 dark:text-yellow-400',
}

interface AlertFeedProps {
  /** Max number of alerts to show. Defaults to 20. */
  limit?: number
}

export function AlertFeed({ limit = 20 }: AlertFeedProps) {
  const allAlerts  = useAlertStore((s) => s.alerts)
  const dismiss    = useAlertStore((s) => s.dismissAlert)
  const clearAll   = useAlertStore((s) => s.clearAll)
  const alerts     = allAlerts.filter((a) => !a.dismissed)

  const visible = alerts.slice(0, limit)

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900">
          <Bell className="h-6 w-6 opacity-20" />
        </div>
        <p className="text-sm font-medium">System normal. No active alerts.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">
            Live Intelligence
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-500" 
          onClick={clearAll}
        >
          Dismiss All
        </Button>
      </div>
      
      <ScrollArea className="max-h-[420px] px-4">
        <div className="flex flex-col gap-2 pb-4 pr-3">
          {visible.map((alert) => {
            const Icon = ALERT_ICON[alert.type]
            return (
              <div
                key={alert.id}
                className={cn(
                  "group relative flex items-start gap-3 overflow-hidden rounded-xl border px-3.5 py-3 transition-all duration-300 animate-[in_0.4s_ease-out]",
                  ALERT_STYLE[alert.type]
                )}
              >
                <div className="mt-0.5 rounded-lg bg-white/50 p-1.5 shadow-sm dark:bg-black/20">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                </div>
                
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold leading-tight tracking-tight">
                    {alert.message}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {alert.type.replace('-', ' ')} ·{' '}
                    {formatDistanceToNow(new Date(alert.received_at), { addSuffix: true })}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Dismiss alert"
                  onClick={() => dismiss(alert.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

