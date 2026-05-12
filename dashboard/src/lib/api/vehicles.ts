import type { KyInstance } from 'ky'
import type { ActiveVehicle, VehicleAsset } from '@/types'

export interface VehicleListResponse {
  data:  VehicleAsset[]
  total: number
}

export interface CreateVehiclePayload {
  vehicle_id:   string
  vehicle_type: string
  capacity_kg:  number
  registration: string
  status?:      string
  driver_id?:   string | null
}

export type UpdateVehiclePayload = Partial<Omit<CreateVehiclePayload, 'vehicle_id'> & { active: boolean }>

export async function getActiveVehicles(api: KyInstance) {
  const res = await api.get('api/v1/vehicles/active').json<{ vehicles: ActiveVehicle[] }>()
  console.log('[API] getActiveVehicles payload:', res)
  return res
}

export async function getVehicles(api: KyInstance): Promise<VehicleListResponse> {
  const res = await api.get('data-analysis/api/v1/vehicles').json<VehicleListResponse>()
  console.log('[API] getVehicles payload:', res)
  return res
}

export async function createVehicle(api: KyInstance, payload: CreateVehiclePayload): Promise<VehicleAsset> {
  const res = await api.post('data-analysis/api/v1/vehicles', { json: payload }).json<VehicleAsset>()
  console.log('[API] createVehicle payload:', res)
  return res
}

export async function updateVehicle(api: KyInstance, vehicleId: string, payload: UpdateVehiclePayload): Promise<VehicleAsset> {
  const res = await api.patch(`data-analysis/api/v1/vehicles/${vehicleId}`, { json: payload }).json<VehicleAsset>()
  console.log('[API] updateVehicle payload:', res)
  return res
}

export async function deactivateVehicle(api: KyInstance, vehicleId: string): Promise<VehicleAsset> {
  const res = await api.patch(`data-analysis/api/v1/vehicles/${vehicleId}`, { json: { active: false } }).json<VehicleAsset>()
  console.log('[API] deactivateVehicle payload:', res)
  return res
}
