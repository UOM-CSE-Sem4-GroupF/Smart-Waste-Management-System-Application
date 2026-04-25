import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeWeight, upsertBin, getBin, getAllBins,
  getBinHistory, getBinsByZone, clearAll,
} from '../store';

beforeEach(() => clearAll());

describe('computeWeight', () => {
  it('uses category-specific density', () => {
    // glass: 2.5 kg/L, 50% of 240L → 300 kg
    expect(computeWeight(50, 240, 'glass')).toBe(300);
  });

  it('uses general density as default', () => {
    // general: 0.3 kg/L, 100% of 100L → 30 kg
    expect(computeWeight(100, 100, 'general')).toBe(30);
  });

  it('rounds to 2 decimal places', () => {
    // plastic: 0.05, 33% of 240L → 3.96
    expect(computeWeight(33, 240, 'plastic')).toBe(3.96);
  });
});

describe('upsertBin — create', () => {
  it('applies defaults for omitted fields', () => {
    const bin = upsertBin({ bin_id: 'B1', fill_level_pct: 50, urgency_score: 40, urgency_status: 'monitor' });
    expect(bin.waste_category).toBe('general');
    expect(bin.volume_litres).toBe(240);
    expect(bin.zone_id).toBe('unknown');
    expect(bin.collection_status).toBe('available');
    expect(bin.lat).toBe(0);
    expect(bin.lng).toBe(0);
  });

  it('auto-computes weight when not supplied', () => {
    const bin = upsertBin({ bin_id: 'B1', fill_level_pct: 100, volume_litres: 100, waste_category: 'general', urgency_score: 0, urgency_status: 'normal' });
    expect(bin.estimated_weight_kg).toBe(30);
  });

  it('honours explicit weight when supplied', () => {
    const bin = upsertBin({ bin_id: 'B1', fill_level_pct: 100, estimated_weight_kg: 99, urgency_score: 0, urgency_status: 'normal' });
    expect(bin.estimated_weight_kg).toBe(99);
  });
});

describe('upsertBin — update', () => {
  it('pushes previous state to history on update', () => {
    upsertBin({ bin_id: 'B1', fill_level_pct: 30, urgency_score: 20, urgency_status: 'normal' });
    upsertBin({ bin_id: 'B1', fill_level_pct: 90, urgency_score: 90, urgency_status: 'critical' });
    const hist = getBinHistory('B1');
    expect(hist).toHaveLength(1);
    expect(hist[0].fill_level_pct).toBe(30);
  });

  it('inherits existing fields when patch omits them', () => {
    upsertBin({ bin_id: 'B1', fill_level_pct: 50, urgency_score: 50, urgency_status: 'monitor', zone_id: 'Z1' });
    const updated = upsertBin({ bin_id: 'B1', fill_level_pct: 80, urgency_score: 80, urgency_status: 'urgent' });
    expect(updated.zone_id).toBe('Z1');
  });

  it('caps history at 50 entries', () => {
    for (let i = 0; i <= 55; i++) {
      upsertBin({ bin_id: 'B1', fill_level_pct: i, urgency_score: 0, urgency_status: 'normal' });
    }
    expect(getBinHistory('B1').length).toBeLessThanOrEqual(50);
  });
});

describe('getBin / getAllBins', () => {
  it('returns undefined for unknown id', () => {
    expect(getBin('NOPE')).toBeUndefined();
  });

  it('returns all stored bins', () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal' });
    upsertBin({ bin_id: 'B', fill_level_pct: 20, urgency_score: 0, urgency_status: 'normal' });
    expect(getAllBins()).toHaveLength(2);
  });
});

describe('getBinsByZone', () => {
  it('returns only bins in the given zone', () => {
    upsertBin({ bin_id: 'A', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z1' });
    upsertBin({ bin_id: 'B', fill_level_pct: 10, urgency_score: 0, urgency_status: 'normal', zone_id: 'Z2' });
    const result = getBinsByZone('Z1');
    expect(result).toHaveLength(1);
    expect(result[0].bin_id).toBe('A');
  });

  it('returns empty array for unknown zone', () => {
    expect(getBinsByZone('NOWHERE')).toHaveLength(0);
  });
});
