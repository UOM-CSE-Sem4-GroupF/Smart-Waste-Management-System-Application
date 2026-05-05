import { BinState, WasteCategory, AVG_KG_PER_LITRE } from './types';

const bins    = new Map<string, BinState>();
const history = new Map<string, BinState[]>();

// Seed data so the dashboard shows something without Kafka
const SEED_BINS: BinState[] = [
  { bin_id: 'BIN-001', fill_level_pct: 87, urgency_score: 87, urgency_status: 'critical',  collection_status: 'available', estimated_weight_kg: 62.6,  waste_category: 'general',   volume_litres: 240, zone_id: 'Zone-1', lat: 6.9271, lng: 79.8612, battery_pct: 92, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-002', fill_level_pct: 62, urgency_score: 62, urgency_status: 'monitor',   collection_status: 'available', estimated_weight_kg: 14.9,  waste_category: 'plastic',   volume_litres: 120, zone_id: 'Zone-1', lat: 6.9285, lng: 79.8640, battery_pct: 45, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-003', fill_level_pct: 45, urgency_score: 45, urgency_status: 'normal',    collection_status: 'available', estimated_weight_kg: 97.2,  waste_category: 'glass',     volume_litres: 360, zone_id: 'Zone-1', lat: 6.9260, lng: 79.8590, battery_pct: 78, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-004', fill_level_pct: 91, urgency_score: 91, urgency_status: 'critical',  collection_status: 'available', estimated_weight_kg: 19.6,  waste_category: 'paper',     volume_litres: 240, zone_id: 'Zone-2', lat: 6.9355, lng: 79.8495, battery_pct: 12, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-005', fill_level_pct: 73, urgency_score: 73, urgency_status: 'urgent',    collection_status: 'available', estimated_weight_kg: 157.7, waste_category: 'food_waste', volume_litres: 480, zone_id: 'Zone-2', lat: 6.9370, lng: 79.8510, battery_pct: 67, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-006', fill_level_pct: 28, urgency_score: 28, urgency_status: 'normal',    collection_status: 'available', estimated_weight_kg: 4.0,   waste_category: 'e_waste',   volume_litres: 120, zone_id: 'Zone-2', lat: 6.9340, lng: 79.8480, battery_pct: 88, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-007', fill_level_pct: 55, urgency_score: 55, urgency_status: 'monitor',   collection_status: 'available', estimated_weight_kg: 39.6,  waste_category: 'general',   volume_litres: 240, zone_id: 'Zone-3', lat: 6.9215, lng: 79.8780, battery_pct: 55, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-008', fill_level_pct: 80, urgency_score: 80, urgency_status: 'urgent',    collection_status: 'available', estimated_weight_kg: 28.8,  waste_category: 'plastic',   volume_litres: 240, zone_id: 'Zone-3', lat: 6.9200, lng: 79.8800, battery_pct: 33, last_reading_at: new Date().toISOString() },
  { bin_id: 'BIN-009', fill_level_pct: 15, urgency_score: 15, urgency_status: 'normal',    collection_status: 'available', estimated_weight_kg: 5.4,   waste_category: 'general',   volume_litres: 120, zone_id: 'Zone-3', lat: 6.9230, lng: 79.8760, battery_pct: 99, last_reading_at: new Date().toISOString() },
];
SEED_BINS.forEach(b => bins.set(b.bin_id, b));

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
    battery_pct:        patch.battery_pct        ?? existing?.battery_pct        ?? 100,
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
