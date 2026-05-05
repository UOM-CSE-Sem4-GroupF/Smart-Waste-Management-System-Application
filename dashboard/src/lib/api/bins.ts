import type { KyInstance } from 'ky'
import type { Bin, BinHistory, ZoneSummary } from '@/types'

export async function getBins(
  api: KyInstance,
  params?: {
    zone_id?:       number
    status?:        string
    waste_category?: string
    page?:          number
    limit?:         number
  },
) {
  return api
    .get('api/v1/bins', { searchParams: params ?? {} })
    .json<{ data: Bin[]; total: number; page: number; limit: number }>()
}

export async function getBin(api: KyInstance, binId: string) {
  return api.get(`api/v1/bins/${binId}`).json<Bin>()
}

export async function getBinHistory(api: KyInstance, binId: string) {
  return api.get(`api/v1/bins/${binId}/history`).json<BinHistory>()
}

export async function getZoneSummary(api: KyInstance, zoneId: number) {
  return api.get(`api/v1/zones/${zoneId}/summary`).json<ZoneSummary>()
}
