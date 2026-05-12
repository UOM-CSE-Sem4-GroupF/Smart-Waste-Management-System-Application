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
  return api.get('api/v1/vehicles/active').json<{ vehicles: ActiveVehicle[] }>()
}

export async function getVehicles(api: KyInstance): Promise<VehicleListResponse> {
  return api.get('api/v1/vehicles').json()
}

export async function createVehicle(api: KyInstance, payload: CreateVehiclePayload): Promise<VehicleAsset> {
  return api.post('api/v1/vehicles', { json: payload }).json()
}

export async function updateVehicle(api: KyInstance, vehicleId: string, payload: UpdateVehiclePayload): Promise<VehicleAsset> {
  return api.patch(`api/v1/vehicles/${vehicleId}`, { json: payload }).json()
}

export async function deactivateVehicle(api: KyInstance, vehicleId: string): Promise<VehicleAsset> {
  return api.patch(`api/v1/vehicles/${vehicleId}`, { json: { active: false } }).json()
}
