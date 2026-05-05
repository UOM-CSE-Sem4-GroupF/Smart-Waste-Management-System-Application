'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { useAlertStore, type Alert } from '@/store/alertStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ── colour config ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<Alert['type'], { strip: string; label: string }> = {
  urgent:    { strip: 'bg-orange-500', label: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  deviation: { strip: 'bg-yellow-400', label: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  escalated: { strip: 'bg-red-500',    label: 'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300' },
}

// ── banner-level colour (driven by highest-severity unacked alert) ─────────────
function bannerColour(alerts: Alert[]): string {
  const unacked = alerts.filter((a) => !a.acknowledged)
  if (unacked.some((a) => a.type === 'escalated')) return 'border-red-500    bg-red-50    dark:bg-red-950/30'
  if (unacked.some((a) => a.type === 'urgent'))    return 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
  if (unacked.some((a) => a.type === 'deviation')) return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
  return 'border-border bg-muted/30'
}

// ── individual alert row ───────────────────────────────────────────────────────
function AlertRow({ alert, onDismiss }: { alert: Alert; onDismiss: (id: string) => void }) {
  const router    = useRouter()
  const styles    = TYPE_STYLES[alert.type]
  const timestamp = format(new Date(alert.received_at), 'HH:mm:ss')

  return (
    <div className={cn('flex items-start gap-3 rounded-md px-3 py-2', alert.acknowledged && 'opacity-50')}>
      {/* Type badge */}
      <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide', styles.label)}>
        {alert.type}
      </span>

      {/* Timestamp */}
      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">{timestamp}</span>

      {/* Message */}
      <p className="flex-1 text-sm leading-snug">{alert.message}</p>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        {!alert.acknowledged && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onDismiss(alert.id)}
          >
            Dismiss
          </Button>
        )}
        {alert.bin_id && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => router.push('/dashboard/map')}
          >
            View on map
          </Button>
        )}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
export function AlertBanner() {
  const [expanded, setExpanded]       = useState(false)
  const { alerts, unacknowledgedCount, acknowledgeAlert } = useAlertStore()

  if (alerts.length === 0) return null

  const colour = bannerColour(alerts)

  return (
    <div className={cn('border-b transition-colors', colour)} role="region" aria-label="Alert banner">
      {/* Collapsed strip */}
      <button
        className="flex w-full items-center gap-3 px-6 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          {unacknowledgedCount > 0
            ? `${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? 's' : ''}`
            : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} (all dismissed)`}
        </span>
        {expanded ? (
          <ChevronUp className="ml-auto h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
        )}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="max-h-72 overflow-y-auto border-t border-border px-3 py-2">
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Recent alerts</span>
            {unacknowledgedCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => alerts.filter((a) => !a.acknowledged).forEach((a) => acknowledgeAlert(a.id))}
              >
                Dismiss all
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onDismiss={acknowledgeAlert} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
