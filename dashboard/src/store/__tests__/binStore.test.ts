import { describe, it, expect, beforeEach } from 'vitest'
import { useBinStore } from '../binStore'

describe('binStore', () => {
  beforeEach(() => useBinStore.setState({ bins: new Map(), zones: new Map() }))

  it('adds a bin on updateBin', () => {
    const payload = { bin_id: 'BIN-001', status: 'urgent', urgency_score: 85 } as any
    useBinStore.getState().updateBin(payload)
    expect(useBinStore.getState().bins.get('BIN-001')?.urgency_score).toBe(85)
  })

  it('overwrites existing bin on updateBin', () => {
    const p1 = { bin_id: 'BIN-001', status: 'monitor', urgency_score: 55 } as any
    const p2 = { bin_id: 'BIN-001', status: 'urgent',  urgency_score: 85 } as any
    useBinStore.getState().updateBin(p1)
    useBinStore.getState().updateBin(p2)
    expect(useBinStore.getState().bins.get('BIN-001')?.status).toBe('urgent')
  })

  it('sets all bins on setBins', () => {
    const bins = [
      { bin_id: 'BIN-001', status: 'normal', urgency_score: 10 } as any,
      { bin_id: 'BIN-002', status: 'critical', urgency_score: 95 } as any,
    ]
    useBinStore.getState().setBins(bins)
    expect(useBinStore.getState().bins.size).toBe(2)
    expect(useBinStore.getState().bins.get('BIN-002')?.status).toBe('critical')
  })
})
