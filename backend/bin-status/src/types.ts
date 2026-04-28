export type WasteCategory = 'food_waste' | 'paper' | 'glass' | 'plastic' | 'general' | 'e_waste';
export type UrgencyStatus = 'normal' | 'monitor' | 'urgent' | 'critical';
export type CollectionStatus = 'available' | 'pending_collection' | 'collecting' | 'collected';

export const AVG_KG_PER_LITRE: Record<WasteCategory, number> = {
  food_waste: 0.90,
  paper:      0.10,
  glass:      2.50,
  plastic:    0.05,
  general:    0.30,
  e_waste:    3.20,
};

export interface BinState {
  bin_id:              string;
  fill_level_pct:      number;
  urgency_score:       number;
  urgency_status:      UrgencyStatus;
  collection_status:   CollectionStatus;
  estimated_weight_kg: number;
  waste_category:      WasteCategory;
  volume_litres:       number;
  zone_id:             string;
  lat:                 number;
  lng:                 number;
  battery_pct:         number;
  last_reading_at:     string;
  last_collected_at?:  string;
}

export interface KafkaEnvelope<T = Record<string, unknown>> {
  version:        string;
  source_service: string;
  timestamp:      string;
  payload:        T;
}

export interface BinProcessedPayload {
  bin_id:              string;
  fill_level_pct:      number;
  urgency_score:       number;
  urgency_status?:     UrgencyStatus;
  estimated_weight_kg?: number;
  waste_category?:     WasteCategory;
  volume_litres?:      number;
  zone_id?:            string;
  latitude?:           number;
  longitude?:          number;
  battery_pct?:        number;
}
