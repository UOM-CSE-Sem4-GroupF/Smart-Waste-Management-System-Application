'use client'
import { Bell, AlertTriangle, TriangleAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAlertStore } from '@/store/alertStore'
import type { Alert } from '@/store/alertStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const ALERT_ICON: Record<Alert['type'], React.ElementType> = {
  urgent:    Bell,
  escalated: AlertTriangle,
  deviation: TriangleAlert,
}

const ALERT_COLOR: Record<Alert['type'], string> = {
  urgent:    'text-red-500',
  escalated: 'text-orange-500',
  deviation: 'text-yellow-500',
}

interface AlertFeedProps {
  /** Max number of alerts to show. Defaults to 20. */
  limit?: number
}

export function AlertFeed({ limit = 20 }: AlertFeedProps) {
  const allAlerts  = useAlertStore((s) => s.alerts)
  const acknowledge = useAlertStore((s) => s.acknowledgeAlert)
  const clearAll    = useAlertStore((s) => s.clearAll)
  const alerts      = allAlerts.filter((a) => !a.acknowledged)

  const visible = alerts.slice(0, limit)

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Bell className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm">No active alerts</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">{visible.length} alert{visible.length !== 1 ? 's' : ''}</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>
          Clear all
        </Button>
      </div>
      <ScrollArea className="max-h-[360px]">
        <div className="flex flex-col gap-1 pr-2">
          {visible.map((alert) => {
            const Icon = ALERT_ICON[alert.type]
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ALERT_COLOR[alert.type])} />
                <div className="min-w-0 flex-1">
                  <p className="break-words">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                    {alert.type.replace('-', ' ')} ·{' '}
                    {formatDistanceToNow(new Date(alert.received_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Acknowledge alert"
                  onClick={() => acknowledge(alert.id)}
                >
                  ×
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
