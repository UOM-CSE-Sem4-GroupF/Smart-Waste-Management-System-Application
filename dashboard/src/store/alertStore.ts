import { create } from 'zustand'

export interface Alert {
  id:          string
  type:        'urgent' | 'escalated' | 'deviation' | 'weight-limit'
  bin_id?:     string
  job_id?:     string
  zone_id?:    number  // optional — not present on weight-limit alerts
  message:     string
  received_at: number  // Date.now()
  dismissed:   boolean
}

interface AlertStore {
  alerts: Alert[]
  addAlert:     (payload: Omit<Alert, 'id' | 'received_at' | 'dismissed'>) => void
  dismissAlert: (id: string) => void
  clearAll:     () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],

  addAlert: (payload) =>
    set((state) => ({
      alerts: [
        { ...payload, id: crypto.randomUUID(), received_at: Date.now(), dismissed: false },
        ...state.alerts.slice(0, 49), // keep last 50
      ],
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    })),

  clearAll: () => set({ alerts: [] }),
}))
