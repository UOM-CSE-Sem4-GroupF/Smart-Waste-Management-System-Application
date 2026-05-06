import { create } from 'zustand'
import type { BinUpdatePayload, ZoneStatsPayload } from '@/types'

interface BinStore {
  bins:  Map<string, BinUpdatePayload>
  zones: Map<number, ZoneStatsPayload>
  selectedBinId: string | null
  updateBin:  (payload: BinUpdatePayload) => void
  updateZone: (payload: ZoneStatsPayload) => void
  setBins:    (bins: BinUpdatePayload[]) => void // called on initial REST load
  setSelectedBinId: (id: string | null) => void
}

export const useBinStore = create<BinStore>((set) => ({
  bins:  new Map(),
  zones: new Map(),
  selectedBinId: null,

  updateBin: (payload) =>
    set((state) => {
      const next = new Map(state.bins)
      next.set(payload.bin_id, payload)
      return { bins: next }
    }),

  updateZone: (payload) =>
    set((state) => {
      const next = new Map(state.zones)
      next.set(payload.zone_id, payload)
      return { zones: next }
    }),

  setBins: (bins) =>
    set(() => ({
      bins: new Map(bins.map((b) => [b.bin_id, b])),
    })),

  setSelectedBinId: (id) => set({ selectedBinId: id }),
}))

