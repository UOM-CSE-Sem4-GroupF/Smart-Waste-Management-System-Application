import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload, VehiclePositionPayload } from '@/types'

export interface MapFilters {
  status:        string[]
  wasteCategory: string[]
  zoneId:        number | null
}

interface MapStore {
  bins:           Map<string, BinUpdatePayload>
  vehicles:       Map<string, VehiclePositionPayload>
  zoneStats:      Map<number, ZoneStatsPayload>
  selectedBinId:  string | null
  selectedZoneId: number | null
  filters: MapFilters

  // Bin actions
  updateBin:   (event: BinUpdatePayload) => void
  setBins:     (bins: BinUpdatePayload[]) => void

  // Vehicle actions
  updateVehicle: (event: VehiclePositionPayload) => void
  setVehicles:   (vehicles: VehiclePositionPayload[]) => void
  removeVehicle: (vehicleId: string) => void

  // Zone stats actions
  updateZoneStats: (event: ZoneStatsPayload) => void

  // Selection & filter actions
  selectBin:       (binId: string | null) => void
  setFilter:       (key: keyof MapFilters, value: MapFilters[keyof MapFilters]) => void

  // Derived
  getFilteredBins: () => BinUpdatePayload[]
}

export const useMapStore = create<MapStore>((set, get) => ({
  bins:           new Map(),
  vehicles:       new Map(),
  zoneStats:      new Map(),
  selectedBinId:  null,
  selectedZoneId: null,
  filters:        { status: [], wasteCategory: [], zoneId: null },

  updateBin: (event) =>
    set((state) => {
      const next = new Map(state.bins)
      next.set(event.bin_id, { ...next.get(event.bin_id), ...event })
      return { bins: next }
    }),

  setBins: (bins) =>
    set(() => ({
      bins: new Map(bins.map((b) => [b.bin_id, b])),
    })),

  updateVehicle: (event) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.set(event.vehicle_id, event)
      return { vehicles: next }
    }),

  setVehicles: (list) =>
    set(() => ({
      vehicles: new Map(list.map((v) => [v.vehicle_id, v])),
    })),

  removeVehicle: (vehicleId) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.delete(vehicleId)
      return { vehicles: next }
    }),

  updateZoneStats: (event) =>
    set((state) => {
      const next = new Map(state.zoneStats)
      next.set(event.zone_id, event)
      return { zoneStats: next }
    }),

  selectBin: (binId) => set({ selectedBinId: binId }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  getFilteredBins: () => {
    const { bins, filters } = get()
    return Array.from(bins.values()).filter((bin) => {
      if (filters.zoneId != null && bin.zone_id !== filters.zoneId) return false
      if (filters.status.length > 0 && !filters.status.includes(bin.status)) return false
      if (filters.wasteCategory.length > 0 && !filters.wasteCategory.includes(bin.waste_category)) return false
      return true
    })
  },
}))
