import type { KyInstance } from 'ky'

export interface WasteGenerationSeries {
  label:      string
  food_waste: number
  paper:      number
  glass:      number
  plastic:    number
  general:    number
  e_waste:    number
}

export interface WasteGenerationTrend {
  zone_id:       number
  period:        string
  series:        WasteGenerationSeries[]
  model_version: string
}

export interface ZoneGenerationPrediction {
  zone_id:              number
  date_range:           string
  predicted_kg_per_day: number
  by_waste_category:    Record<string, number>
  model_version:        string
}

export async function getWasteGenerationTrends(
  api: KyInstance,
  params: { zone_id: number; period?: 'week' | 'month' | 'quarter' },
) {
  return api
    .get('api/v1/ml/trends/waste-generation', { searchParams: params })
    .json<WasteGenerationTrend>()
}

export async function getZoneGenerationPrediction(
  api: KyInstance,
  zoneId: number,
) {
  return api
    .get('api/v1/ml/predict/zone-generation', {
      searchParams: { zone_id: String(zoneId), date_range: 'next_7_days' },
    })
    .json<ZoneGenerationPrediction>()
}

export async function getFillTimePrediction(api: KyInstance, binId: string) {
  return api
    .get('api/v1/ml/predict/fill-time', { searchParams: { bin_id: binId } })
    .json()
}
