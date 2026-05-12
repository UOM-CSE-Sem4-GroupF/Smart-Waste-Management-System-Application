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
  return api.get('api/v1/drivers', { searchParams: params as Record<string, string | number> }).json()
}

export async function createDriver(api: KyInstance, payload: CreateDriverPayload): Promise<Driver> {
  return api.post('api/v1/drivers', { json: payload }).json()
}

export async function updateDriver(api: KyInstance, driverId: string, payload: UpdateDriverPayload): Promise<Driver> {
  return api.patch(`api/v1/drivers/${driverId}`, { json: payload }).json()
}

export async function deactivateDriver(api: KyInstance, driverId: string): Promise<void> {
  await api.patch(`api/v1/drivers/${driverId}`, { json: { active: false } })
}
