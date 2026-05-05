import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload, VehiclePositionPayload } from '@/types'

export interface MapFilters {
  status:        string[]
  wasteCategory: string[]
  zoneId:        number | null
}

interface MapStore {
  bins:                  Map<string, BinUpdatePayload>
  vehicles:              Map<string, VehiclePositionPayload>
  zoneStats:             Map<number, ZoneStatsPayload>
  // Throttle vehicle position updates — stores last accepted timestamp per vehicle
  _vehicleLastUpdated:   Map<string, number>
  selectedBinId:         string | null
  selectedZoneId:        number | null
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
  bins:                 new Map(),
  vehicles:             new Map(),
  zoneStats:            new Map(),
  _vehicleLastUpdated:  new Map(),
  selectedBinId:        null,
  selectedZoneId:       null,
  filters:              { status: [], wasteCategory: [], zoneId: null },

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

  // Throttle: accept at most 1 update per vehicle per second to avoid
  // flooding React with re-renders from high-frequency GPS packets.
  updateVehicle: (event) => {
    const now = Date.now()
    const last = get()._vehicleLastUpdated.get(event.vehicle_id) ?? 0
    if (now - last < 1000) return  // drop if < 1s since last accepted update
    set((state) => {
      const nextVehicles  = new Map(state.vehicles)
      const nextTimestamp = new Map(state._vehicleLastUpdated)
      nextVehicles.set(event.vehicle_id, event)
      nextTimestamp.set(event.vehicle_id, now)
      return { vehicles: nextVehicles, _vehicleLastUpdated: nextTimestamp }
    })
  },

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
