import type { KyInstance } from 'ky'

export interface Zone {
  id:         number
  name:       string
  district?:  string
  active:     boolean
}

export interface ZoneListResponse {
  data:  Zone[]
  total: number
}

export async function getZones(api: KyInstance): Promise<ZoneListResponse> {
  return api.get('api/v1/zones').json()
}
