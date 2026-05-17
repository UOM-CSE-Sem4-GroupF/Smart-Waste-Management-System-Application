import type { KyInstance } from 'ky'
import type { Driver } from '@/types'

export interface DriverListResponse {
  data:  Driver[]
  total: number
}

export interface CreateDriverPayload {
  driver_id:    string
  name:         string
  zone_id?:     number
  vehicle_id?:  string
  // contact fields — wired later via Keycloak user table
  email?:       string
  phone?:       string
  license_no?:  string
}

export type UpdateDriverPayload = Partial<Omit<CreateDriverPayload, 'driver_id'>>

export async function getDrivers(api: KyInstance, params?: { zone_id?: number; limit?: number; offset?: number }): Promise<DriverListResponse> {
  try {
    const res = await api.get('api/v1/drivers', { searchParams: params as Record<string, string | number> }).json<DriverListResponse>()
    return res
  } catch (error) {
    console.warn('[API] getDrivers failed (Endpoint likely missing):', error)
    return { data: [], total: 0 }
  }
}

export async function createDriver(api: KyInstance, payload: CreateDriverPayload): Promise<Driver> {
  const res = await api.post('api/v1/drivers', { json: payload }).json<Driver>()
  console.log('[API] createDriver payload:', res)
  return res
}

export async function updateDriver(api: KyInstance, driverId: string, payload: UpdateDriverPayload): Promise<Driver> {
  const res = await api.patch(`api/v1/drivers/${driverId}`, { json: payload }).json<Driver>()
  console.log('[API] updateDriver payload:', res)
  return res
}

export async function deactivateDriver(api: KyInstance, driverId: string): Promise<void> {
  console.log('[API] deactivateDriver calling for:', driverId)
  await api.patch(`api/v1/drivers/${driverId}`, { json: { active: false } })
}
