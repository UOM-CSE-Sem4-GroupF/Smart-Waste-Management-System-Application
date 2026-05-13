import type { KyInstance } from 'ky'

export interface WasteTrendPoint {
  timestamp:    string
  zone_id:      number
  zone_name?:   string
  avg_fill_pct: number
}

export interface WasteTrendsResponse {
  series:       WasteTrendPoint[]
  generated_at: string
}

export interface ZoneForecastPoint {
  date:      string
  predicted: number
  lower_ci:  number
  upper_ci:  number
}

export interface ZoneForecastResponse {
  zone_id:   number
  zone_name: string
  forecasts: ZoneForecastPoint[]
}

export async function getWasteGenerationTrends(
  api: KyInstance,
  params: { zone_id?: number; days?: number },
): Promise<WasteTrendsResponse> {
  return api
    .get('api/v1/ml/trends/waste-generation', { searchParams: params })
    .json<WasteTrendsResponse>()
}

export async function getFillTimePrediction(
  api: KyInstance,
  binId: string,
): Promise<{ bin_id: string; predicted_full_at: string; confidence: number; model_version: string }> {
  return api
    .get('api/v1/ml/predict/fill-time', { searchParams: { bin_id: binId } })
    .json()
}

export async function getZoneForecast(
  api: KyInstance,
  params: { zone_id: number; date_range?: string },
): Promise<ZoneForecastResponse> {
  return api
    .get('api/v1/ml/predict/zone-generation', { searchParams: params })
    .json<ZoneForecastResponse>()
}
