'use client'
import { cn } from '@/lib/utils'
import { useSocket } from '@/components/providers/SocketProvider'

type Status = 'connected' | 'reconnecting' | 'disconnected'

const statusConfig: Record<Status, { label: string; className: string }> = {
  connected:    { label: '● Live',           className: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' },
  reconnecting: { label: '⟳ Reconnecting…', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' },
  disconnected: { label: '○ Disconnected',   className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' },
}

export function ConnectionBadge() {
  const socket = useSocket()
  const status: Status = socket?.connected ? 'connected' : 'disconnected'
  const cfg = statusConfig[status]
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}
