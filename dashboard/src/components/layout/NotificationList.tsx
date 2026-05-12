'use client'
import { useAlertStore } from '@/store/alertStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Check, Trash2, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  urgent:    'Urgent',
  escalated: 'Escalated',
  deviation: 'Deviation',
  initiated: 'Job Initiated',
}

const TYPE_COLOUR: Record<string, string> = {
  urgent:    'text-orange-500',
  escalated: 'text-red-500',
  deviation: 'text-yellow-500',
  initiated: 'text-blue-500',
}

export function NotificationList() {
  const alerts         = useAlertStore((s) => s.alerts)
  const acknowledge    = useAlertStore((s) => s.acknowledgeAlert)
  const clearAll       = useAlertStore((s) => s.clearAll)

  const unread = alerts.filter((a) => !a.acknowledged).length

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1">
              {unread}
            </Badge>
          )}
        </div>
        {alerts.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground gap-1"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* List */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Check className="h-6 w-6 opacity-40" />
          <span className="text-sm">All caught up</span>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-96">
          <ul className="divide-y">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={cn(
                  'flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50',
                  !alert.acknowledged && 'bg-accent/30',
                )}
              >
                {alert.type === 'initiated' ? (
                  <Zap className={cn('h-4 w-4 mt-0.5 shrink-0', TYPE_COLOUR[alert.type])} />
                ) : (
                  <AlertTriangle
                    className={cn('h-4 w-4 mt-0.5 shrink-0', TYPE_COLOUR[alert.type] ?? 'text-muted-foreground')}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-medium">{TYPE_LABEL[alert.type] ?? alert.type}</span>
                    {alert.bin_id && (
                      <span className="text-xs text-muted-foreground">{alert.bin_id}</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug line-clamp-2">
                    {alert.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                    {formatDistanceToNow(new Date(alert.received_at), { addSuffix: true })}
                  </span>
                </div>
                {!alert.acknowledged && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => acknowledge(alert.id)}
                    title="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
