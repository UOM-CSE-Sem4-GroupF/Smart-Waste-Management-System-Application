import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore } from '../mapStore'
import type { BinUpdatePayload, VehiclePositionPayload } from '@/types'

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

const makeVehicle = (overrides: Partial<VehiclePositionPayload>): VehiclePositionPayload => ({
  vehicle_id: 'LORRY-01',
  driver_id: 'DRV-001',
  lat: 3.14,
  lng: 101.69,
  speed_kmh: 40,
  job_id: 'JOB-001',
  zone_id: 1,
  bins_collected: 2,
  bins_total: 10,
  cargo_weight_kg: 500,
  cargo_limit_kg: 3000,
  cargo_utilisation_pct: 16.7,
  ...overrides,
})

describe('mapStore — bins', () => {
  beforeEach(() =>
    useMapStore.setState({
      bins: new Map(),
      vehicles: new Map(),
      zoneStats: new Map(),
      selectedBinId: null,
      filters: { status: [], wasteCategory: [], zoneId: null },
    }),
  )

  it('adds a bin on updateBin', () => {
    const payload = makeBin({ bin_id: 'BIN-001', status: 'urgent', urgency_score: 85 })
    useMapStore.getState().updateBin(payload)
    expect(useMapStore.getState().bins.get('BIN-001')?.urgency_score).toBe(85)
  })

  it('merges existing bin on updateBin (preserves lat/lng)', () => {
    useMapStore.getState().setBins([makeBin({ lat: 3.139, lng: 101.687 })])
    useMapStore.getState().updateBin(makeBin({ status: 'urgent', urgency_score: 85, lat: undefined as unknown as number }))
    const bin = useMapStore.getState().bins.get('BIN-001')
    expect(bin?.status).toBe('urgent')
    expect(bin?.lat).toBe(3.139) // preserved from initial REST load
  })

  it('sets all bins on setBins', () => {
    const bins = [
      makeBin({ bin_id: 'BIN-001', status: 'normal',   urgency_score: 10 }),
      makeBin({ bin_id: 'BIN-002', status: 'critical', urgency_score: 95 }),
    ]
    useMapStore.getState().setBins(bins)
    expect(useMapStore.getState().bins.size).toBe(2)
    expect(useMapStore.getState().bins.get('BIN-002')?.status).toBe('critical')
  })
})

describe('mapStore — vehicles', () => {
  beforeEach(() =>
    useMapStore.setState({ vehicles: new Map() }),
  )

  it('adds a vehicle on updateVehicle', () => {
    useMapStore.getState().updateVehicle(makeVehicle({ vehicle_id: 'LORRY-01' }))
    expect(useMapStore.getState().vehicles.has('LORRY-01')).toBe(true)
  })

  it('removes a vehicle on removeVehicle', () => {
    useMapStore.getState().setVehicles([makeVehicle({ vehicle_id: 'LORRY-01' })])
    useMapStore.getState().removeVehicle('LORRY-01')
    expect(useMapStore.getState().vehicles.has('LORRY-01')).toBe(false)
  })
})

describe('mapStore — filters', () => {
  beforeEach(() =>
    useMapStore.setState({
      bins: new Map([
        ['BIN-001', makeBin({ bin_id: 'BIN-001', status: 'urgent',  zone_id: 1, waste_category: 'general' })],
        ['BIN-002', makeBin({ bin_id: 'BIN-002', status: 'normal',  zone_id: 1, waste_category: 'plastic' })],
        ['BIN-003', makeBin({ bin_id: 'BIN-003', status: 'critical', zone_id: 2, waste_category: 'general' })],
      ]),
      filters: { status: [], wasteCategory: [], zoneId: null },
    }),
  )

  it('returns all bins when no filters applied', () => {
    expect(useMapStore.getState().getFilteredBins()).toHaveLength(3)
  })

  it('filters by zone_id', () => {
    useMapStore.getState().setFilter('zoneId', 1)
    expect(useMapStore.getState().getFilteredBins()).toHaveLength(2)
  })

  it('filters by status', () => {
    useMapStore.getState().setFilter('status', ['urgent', 'critical'])
    expect(useMapStore.getState().getFilteredBins()).toHaveLength(2)
  })

  it('filters by wasteCategory', () => {
    useMapStore.getState().setFilter('wasteCategory', ['plastic'])
    expect(useMapStore.getState().getFilteredBins()).toHaveLength(1)
  })

  it('selects a bin', () => {
    useMapStore.getState().selectBin('BIN-001')
    expect(useMapStore.getState().selectedBinId).toBe('BIN-001')
  })
})
