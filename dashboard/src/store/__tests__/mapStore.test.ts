import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore } from '@/store/mapStore'
import type { BinUpdatePayload } from '@/types'

function makebin(overrides: Partial<BinUpdatePayload> = {}): BinUpdatePayload {
  return {
    bin_id:                 'bin-1',
    zone_id:                1,
    fill_level_pct:         50,
    status:                 'normal',
    waste_category:         'general',
    battery_level_pct:      90,
    lat:                    1.3521,
    lng:                    103.8198,
    predicted_full_at:      null,
    has_active_job:         false,
    collection_triggered:   false,
    cluster_id:             'cluster-1',
    cluster_name:           'Cluster 1',
    urgency_score:          0,
    estimated_weight_kg:    0,
    waste_category_colour:  '#22c55e',
    fill_rate_pct_per_hour: 0,
    last_collected_at:      null,
    ...overrides,
  }
}

describe('mapStore', () => {
  beforeEach(() => {
    useMapStore.setState({
      bins:          new Map(),
      vehicles:      new Map(),
      zoneStats:     new Map(),
      selectedBinId: null,
      selectedZoneId: null,
      filters:       { status: [], wasteCategory: [], zoneId: null },
    })
  })

  describe('updateBin', () => {
    it('preserves lat/lng from initial load when socket event omits coords', () => {
      // Seed with full bin including coords
      const initial = makebin({ lat: 1.3521, lng: 103.8198 })
      useMapStore.getState().updateBin(initial)

      // Socket update with no coords (lat/lng undefined)
      const socketUpdate: BinUpdatePayload = {
        ...initial,
        lat:            undefined as unknown as number,
        lng:            undefined as unknown as number,
        fill_level_pct: 75,
        status:         'monitor',
      }
      useMapStore.getState().updateBin(socketUpdate)

      const bin = useMapStore.getState().bins.get('bin-1')
      expect(bin?.lat).toBe(1.3521)
      expect(bin?.lng).toBe(103.8198)
      expect(bin?.fill_level_pct).toBe(75)
      expect(bin?.status).toBe('monitor')
    })

    it('stores a new bin when it does not exist yet', () => {
      useMapStore.getState().updateBin(makebin({ bin_id: 'bin-99' }))
      expect(useMapStore.getState().bins.has('bin-99')).toBe(true)
    })

    it('creates a new Map instance to trigger re-renders', () => {
      const before = useMapStore.getState().bins
      useMapStore.getState().updateBin(makebin())
      const after = useMapStore.getState().bins
      expect(after).not.toBe(before)
    })
  })

  describe('getFilteredBins', () => {
    beforeEach(() => {
      useMapStore.getState().setBins([
        makebin({ bin_id: 'b1', zone_id: 1, status: 'normal',   waste_category: 'general' }),
        makebin({ bin_id: 'b2', zone_id: 1, status: 'critical', waste_category: 'food_waste' }),
        makebin({ bin_id: 'b3', zone_id: 2, status: 'normal',   waste_category: 'general' }),
      ])
    })

    it('returns all bins when filters are empty', () => {
      expect(useMapStore.getState().getFilteredBins()).toHaveLength(3)
    })

    it('filters by status', () => {
      useMapStore.getState().setFilter('status', ['critical'])
      const result = useMapStore.getState().getFilteredBins()
      expect(result).toHaveLength(1)
      expect(result[0].bin_id).toBe('b2')
    })

    it('filters by zoneId', () => {
      useMapStore.getState().setFilter('zoneId', 2)
      const result = useMapStore.getState().getFilteredBins()
      expect(result).toHaveLength(1)
      expect(result[0].bin_id).toBe('b3')
    })

    it('filters by wasteCategory', () => {
      useMapStore.getState().setFilter('wasteCategory', ['organic'])
      const result = useMapStore.getState().getFilteredBins()
      expect(result).toHaveLength(1)
      expect(result[0].bin_id).toBe('b2')
    })

    it('applies multiple filters conjunctively', () => {
      useMapStore.getState().setFilter('zoneId', 1)
      useMapStore.getState().setFilter('status', ['normal'])
      const result = useMapStore.getState().getFilteredBins()
      expect(result).toHaveLength(1)
      expect(result[0].bin_id).toBe('b1')
    })
  })

  describe('selectZone', () => {
    it('sets selectedZoneId', () => {
      useMapStore.getState().selectZone(3)
      expect(useMapStore.getState().selectedZoneId).toBe(3)
    })

    it('clears selectedZoneId when set to null', () => {
      useMapStore.getState().selectZone(3)
      useMapStore.getState().selectZone(null)
      expect(useMapStore.getState().selectedZoneId).toBeNull()
    })
  })
})
