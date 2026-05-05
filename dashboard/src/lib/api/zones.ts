import type { KyInstance } from 'ky'
import type { ZoneSummary } from '@/types'

export interface Zone {
  zone_id:   number
  zone_name: string
  lat?:      number
  lng?:      number
}

export async function getZones(api: KyInstance) {
  return api.get('api/v1/zones').json<Zone[]>()
}

export async function getZoneSummary(zoneId: number, api: KyInstance) {
  return api.get(`api/v1/zones/${zoneId}/summary`).json<ZoneSummary>()
}
