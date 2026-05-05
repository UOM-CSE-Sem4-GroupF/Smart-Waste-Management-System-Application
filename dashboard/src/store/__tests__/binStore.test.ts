import { describe, it, expect, beforeEach } from 'vitest'
import { useBinStore } from '../binStore'
import type { BinUpdatePayload } from '@/types'

const makeBin = (overrides: Partial<BinUpdatePayload>): BinUpdatePayload => ({
  bin_id: 'BIN-001',
  cluster_id: 'CL-01',
  cluster_name: 'Cluster 1',
  zone_id: 1,
  lat: 3.139,
  lng: 101.687,
  fill_level_pct: 50,
  status: 'normal',
  urgency_score: 20,
  estimated_weight_kg: 10,
  waste_category: 'general',
  waste_category_colour: '#808080',
  fill_rate_pct_per_hour: 0.5,
  predicted_full_at: null,
  battery_level_pct: 80,
  has_active_job: false,
  collection_triggered: false,
  last_collected_at: null,
  ...overrides,
})

describe('binStore', () => {
  beforeEach(() => useBinStore.setState({ bins: new Map(), zones: new Map() }))

  it('adds a bin on updateBin', () => {
    const payload = makeBin({ bin_id: 'BIN-001', status: 'urgent', urgency_score: 85 })
    useBinStore.getState().updateBin(payload)
    expect(useBinStore.getState().bins.get('BIN-001')?.urgency_score).toBe(85)
  })

  it('overwrites existing bin on updateBin', () => {
    useBinStore.getState().updateBin(makeBin({ status: 'monitor', urgency_score: 55 }))
    useBinStore.getState().updateBin(makeBin({ status: 'urgent',  urgency_score: 85 }))
    expect(useBinStore.getState().bins.get('BIN-001')?.status).toBe('urgent')
  })

  it('sets all bins on setBins', () => {
    const bins = [
      makeBin({ bin_id: 'BIN-001', status: 'normal',   urgency_score: 10 }),
      makeBin({ bin_id: 'BIN-002', status: 'critical', urgency_score: 95 }),
    ]
    useBinStore.getState().setBins(bins)
    expect(useBinStore.getState().bins.size).toBe(2)
    expect(useBinStore.getState().bins.get('BIN-002')?.status).toBe('critical')
  })
})
