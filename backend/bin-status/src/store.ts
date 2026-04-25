import { BinState, WasteCategory, AVG_KG_PER_LITRE } from './types';

const bins    = new Map<string, BinState>();
const history = new Map<string, BinState[]>();

export function computeWeight(fill_level_pct: number, volume_litres: number, waste_category: WasteCategory): number {
  const density = AVG_KG_PER_LITRE[waste_category] ?? AVG_KG_PER_LITRE.general;
  return parseFloat(((fill_level_pct / 100) * volume_litres * density).toFixed(2));
}

export function upsertBin(patch: Partial<BinState> & { bin_id: string }): BinState {
  const existing = bins.get(patch.bin_id);

  const waste_category = patch.waste_category ?? existing?.waste_category ?? 'general';
  const volume_litres  = patch.volume_litres  ?? existing?.volume_litres  ?? 240;
  const fill_level_pct = patch.fill_level_pct ?? existing?.fill_level_pct ?? 0;

  const estimated_weight_kg = patch.estimated_weight_kg
    ?? computeWeight(fill_level_pct, volume_litres, waste_category);

  const next: BinState = {
    bin_id:             patch.bin_id,
    fill_level_pct,
    urgency_score:      patch.urgency_score      ?? existing?.urgency_score      ?? 0,
    urgency_status:     patch.urgency_status     ?? existing?.urgency_status     ?? 'normal',
    collection_status:  patch.collection_status  ?? existing?.collection_status  ?? 'available',
    estimated_weight_kg,
    waste_category,
    volume_litres,
    zone_id:            patch.zone_id            ?? existing?.zone_id            ?? 'unknown',
    lat:                patch.lat                ?? existing?.lat                ?? 0,
    lng:                patch.lng                ?? existing?.lng                ?? 0,
    last_reading_at:    patch.last_reading_at    ?? new Date().toISOString(),
    last_collected_at:  patch.last_collected_at  ?? existing?.last_collected_at,
  };

  if (existing) {
    const hist = history.get(patch.bin_id) ?? [];
    hist.push(existing);
    if (hist.length > 50) hist.shift();
    history.set(patch.bin_id, hist);
  }

  bins.set(patch.bin_id, next);
  return next;
}

export function getBin(id: string): BinState | undefined        { return bins.get(id); }
export function getAllBins(): BinState[]                         { return [...bins.values()]; }
export function getBinHistory(id: string): BinState[]           { return history.get(id) ?? []; }
export function getBinsByZone(zoneId: string): BinState[]       { return [...bins.values()].filter(b => b.zone_id === zoneId); }
export function clearAll(): void                                 { bins.clear(); history.clear(); }
