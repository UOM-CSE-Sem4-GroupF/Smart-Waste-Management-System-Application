import type { KyInstance } from 'ky'

export async function getWasteGenerationTrends(
  api: KyInstance,
  params: { zone_id?: number; days?: number },
) {
  return api
    .get('api/v1/ml/trends/waste-generation', { searchParams: params })
    .json()
}

export async function getFillTimePrediction(api: KyInstance, binId: string) {
  return api
    .get('api/v1/ml/predict/fill-time', { searchParams: { bin_id: binId } })
    .json()
}
