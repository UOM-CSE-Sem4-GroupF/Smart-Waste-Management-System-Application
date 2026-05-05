'use client'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAlertStore } from '@/store/alertStore'

export function AlertBell() {
  const unread = useAlertStore((s) => s.unacknowledgedCount)
  return (
    <Button variant="ghost" size="icon" className="relative" aria-label="Alerts">
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Button>
  )
}
