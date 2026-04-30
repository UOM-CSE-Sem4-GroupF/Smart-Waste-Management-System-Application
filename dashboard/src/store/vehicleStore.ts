import { create } from 'zustand'
import type { VehiclePositionPayload } from '@/types'

interface VehicleStore {
  vehicles: Map<string, VehiclePositionPayload>
  updateVehicle: (payload: VehiclePositionPayload) => void
  setVehicles:   (vehicles: VehiclePositionPayload[]) => void
}

export const useVehicleStore = create<VehicleStore>((set) => ({
  vehicles: new Map(),

  updateVehicle: (payload) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.set(payload.vehicle_id, payload)
      return { vehicles: next }
    }),

  setVehicles: (list) =>
    set(() => ({
      vehicles: new Map(list.map((v) => [v.vehicle_id, v])),
    })),
}))
