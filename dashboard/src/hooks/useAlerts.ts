'use client'
import { useAlertStore } from '@/store/alertStore'
import type { Alert } from '@/store/alertStore'

/** Returns all non-acknowledged alerts, newest first. */
export function useAlerts(): Alert[] {
  return useAlertStore((s) => s.alerts.filter((a) => !a.acknowledged))
}

/** Returns the count of non-acknowledged alerts — lightweight for the bell badge. */
export function useUnreadAlertCount(): number {
  return useAlertStore((s) => s.alerts.filter((a) => !a.acknowledged).length)
}
