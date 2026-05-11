import { create } from 'zustand'

export interface Alert {
  id:           string
  type:         'urgent' | 'escalated' | 'deviation'
  bin_id?:      string
  job_id?:      string
  zone_id?:     number
  vehicle_id?:  string
  message:      string
  received_at:  string       // ISO 8601 from server
  acknowledged: boolean
}

interface AlertStore {
  alerts: Alert[]
  addAlert:        (payload: Omit<Alert, 'id' | 'received_at' | 'acknowledged'>) => void
  acknowledgeAlert:(id: string) => void
  clearAll:        () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],

  addAlert: (payload) =>
    set((state) => ({
      alerts: [
        {
          ...payload,
          id: crypto.randomUUID(),
          received_at: new Date().toISOString(),
          acknowledged: false,
        },
        ...state.alerts.slice(0, 49), // keep last 50
      ],
    })),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  clearAll: () => set({ alerts: [] }),
}))
