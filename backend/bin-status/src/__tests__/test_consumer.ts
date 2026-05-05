import { BinProcessedPayload, WasteCategory } from '../types';
import { upsertBin, computeWeight } from '../store';

// Paste the eachMessage logic here with a fake message
const fakeMessage = {
  bin_id: 'BIN-001',
  fill_level_pct: 75,
  urgency_score: 0.8,
  urgency_status: 'high',
  waste_category: 'general' as WasteCategory,
  volume_litres: 240,
  zone_id: 'zone-3',
  latitude: 6.0535,
  longitude: 80.2210,
};

const envelope = { payload: fakeMessage, timestamp: new Date().toISOString() };
const p = (envelope.payload ?? envelope) as BinProcessedPayload;

const waste_category = (p.waste_category ?? 'general') as WasteCategory;
const volume_litres  = p.volume_litres ?? 240;
const estimated_weight_kg = computeWeight(p.fill_level_pct, volume_litres, waste_category);

upsertBin({
  bin_id:              p.bin_id,
  fill_level_pct:      p.fill_level_pct,
  urgency_score:       p.urgency_score,
  urgency_status:      p.urgency_status ?? 'normal',
  estimated_weight_kg,
  waste_category,
  volume_litres,
  zone_id:             p.zone_id   ?? 'unknown',
  lat:                 p.latitude  ?? 0,
  lng:                 p.longitude ?? 0,
  last_reading_at:     envelope.timestamp,
});

console.log('upsertBin called successfully');