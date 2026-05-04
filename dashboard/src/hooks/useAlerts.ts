'use client'
import { useAlertStore } from '@/store/alertStore'
import type { Alert } from '@/store/alertStore'

/** Returns all unacknowledged alerts, newest first. */
export function useAlerts(): Alert[] {
  return useAlertStore((s) => s.alerts.filter((a) => !a.acknowledged))
}

/** Returns the count of unacknowledged alerts — lightweight for the bell badge. */
export function useUnreadAlertCount(): number {
  return useAlertStore((s) => s.unacknowledgedCount)
}
