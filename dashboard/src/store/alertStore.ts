import { create } from 'zustand'

export interface Alert {
  id:           string
  type:         'urgent' | 'deviation' | 'escalated'
  bin_id?:      string
  job_id?:      string
  vehicle_id?:  string
  zone_id:      number
  message:      string
  received_at:  string   // ISO 8601
  acknowledged: boolean
}

interface AlertStore {
  alerts:               Alert[]
  unacknowledgedCount:  number
  addAlert:             (payload: Omit<Alert, 'id' | 'received_at' | 'acknowledged'>) => void
  acknowledgeAlert:     (id: string) => void
  clearAll:             () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts:              [],
  unacknowledgedCount: 0,

  addAlert: (payload) =>
    set((state) => {
      const newAlerts = [
        { ...payload, id: crypto.randomUUID(), received_at: new Date().toISOString(), acknowledged: false },
        ...state.alerts.slice(0, 49), // keep last 50
      ]
      return {
        alerts:              newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      }
    }),

  acknowledgeAlert: (id) =>
    set((state) => {
      const newAlerts = state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
      return {
        alerts:              newAlerts,
        unacknowledgedCount: newAlerts.filter((a) => !a.acknowledged).length,
      }
    }),

  clearAll: () => set({ alerts: [], unacknowledgedCount: 0 }),
}))
