'use client'
import { useAlertStore } from '@/store/alertStore'
import type { Alert } from '@/store/alertStore'

/** Returns all non-dismissed alerts, newest first. */
export function useAlerts(): Alert[] {
  return useAlertStore((s) => s.alerts.filter((a) => !a.dismissed))
}

/** Returns the count of non-dismissed alerts — lightweight for the bell badge. */
export function useUnreadAlertCount(): number {
  return useAlertStore((s) => s.alerts.filter((a) => !a.dismissed).length)
}
