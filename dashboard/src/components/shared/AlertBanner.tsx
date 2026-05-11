'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAlertStore } from '@/store/alertStore'
import { cn } from '@/lib/utils'

/**
 * Persistent top-of-page strip for escalated alerts.
 * Slides in from top when new escalated alerts arrive; can be dismissed.
 */
export function AlertBanner() {
  const alerts   = useAlertStore((s) => s.alerts)
  const clearAll = useAlertStore((s) => s.clearAll)
  const [dismissed, setDismissed] = useState(false)

  const escalated = alerts.filter((a) => a.type === 'escalated' && !a.acknowledged)

  // Re-show banner when a new escalated alert arrives
  useEffect(() => {
    if (escalated.length > 0) setDismissed(false)
  }, [escalated.length])

  if (escalated.length === 0 || dismissed) return null

  const latest = escalated[0]

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex items-center gap-3 px-4 py-2.5',
        'bg-red-500/10 border-b border-red-500/30 backdrop-blur',
        'animate-in slide-in-from-top duration-300',
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
      <p className="flex-1 text-xs font-medium text-red-700 dark:text-red-400">
        <span className="font-bold">Escalated alert:</span> {latest.message}
        {escalated.length > 1 && (
          <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
            +{escalated.length - 1} more
          </span>
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="rounded p-0.5 hover:bg-red-500/20 transition-colors"
      >
        <X className="h-3.5 w-3.5 text-red-500" />
      </button>
    </div>
  )
}
