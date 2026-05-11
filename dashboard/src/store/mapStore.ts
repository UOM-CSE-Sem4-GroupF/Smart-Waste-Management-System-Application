import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload, VehiclePositionPayload } from '@/types'

interface MapFilters {
  status:        string[]
  wasteCategory: string[]
  zoneId:        number | null
  clusterId:     string | null
}

interface MapStore {
  // State
  bins:              Map<string, BinUpdatePayload>
  vehicles:          Map<string, VehiclePositionPayload>
  zoneStats:         Map<number, ZoneStatsPayload>
  selectedBinId:     string | null
  selectedVehicleId: string | null
  selectedZoneId:    number | null
  filters:           MapFilters

  // Mutations
  updateBin:       (payload: BinUpdatePayload) => void
  setBins:         (bins: BinUpdatePayload[]) => void
  updateVehicle:   (payload: VehiclePositionPayload) => void
  removeVehicle:   (vehicleId: string) => void
  updateZoneStats: (payload: ZoneStatsPayload) => void
  selectBin:       (binId: string | null) => void
  selectVehicle:   (vehicleId: string | null) => void
  selectZone:      (zoneId: number | null) => void
  setFilter:       (key: keyof MapFilters, value: MapFilters[keyof MapFilters]) => void

  // Computed
  getFilteredBins: () => BinUpdatePayload[]
}

export const useMapStore = create<MapStore>((set, get) => ({
  bins:              new Map(),
  vehicles:          new Map(),
  zoneStats:         new Map(),
  selectedBinId:     null,
  selectedVehicleId: null,
  selectedZoneId:    null,
  filters:           { status: [], wasteCategory: [], zoneId: null, clusterId: null },

  updateBin: (payload) =>
    set((state) => {
      const next = new Map(state.bins)
      // Preserve lat/lng from initial REST load (socket events don't include coords)
      const existing = next.get(payload.bin_id)
      next.set(payload.bin_id, {
        lat: existing?.lat,
        lng: existing?.lng,
        ...existing,
        ...payload,
      })
      return { bins: next }
    }),

  setBins: (bins) =>
    set(() => ({
      bins: new Map(bins.map((b) => [b.bin_id, b])),
    })),

  updateVehicle: (payload) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.set(payload.vehicle_id, payload)
      return { vehicles: next }
    }),

  removeVehicle: (vehicleId) =>
    set((state) => {
      const next = new Map(state.vehicles)
      next.delete(vehicleId)
      return { vehicles: next }
    }),

  updateZoneStats: (payload) =>
    set((state) => {
      const next = new Map(state.zoneStats)
      next.set(payload.zone_id, payload)
      return { zoneStats: next }
    }),

  selectBin: (binId) => set({ selectedBinId: binId, selectedVehicleId: null }),

  selectVehicle: (vehicleId) => set({ selectedVehicleId: vehicleId, selectedBinId: null }),

  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  getFilteredBins: () => {
    const { bins, filters } = get()
    return Array.from(bins.values()).filter((bin) => {
      if (filters.zoneId && bin.zone_id !== filters.zoneId) return false
      if (filters.clusterId && bin.cluster_id !== filters.clusterId) return false
      if (filters.status.length && !filters.status.includes(bin.status)) return false
      if (
        filters.wasteCategory.length &&
        !filters.wasteCategory.includes(bin.waste_category)
      ) return false
      return true
    })
  },
}))
