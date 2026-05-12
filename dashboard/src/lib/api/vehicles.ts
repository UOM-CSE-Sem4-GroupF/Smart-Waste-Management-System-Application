import type { KyInstance } from 'ky'
import type { ActiveVehicle, VehicleAsset } from '@/types'

export async function getActiveVehicles(api: KyInstance) {
  return api.get('api/v1/vehicles/active').json<{ vehicles: ActiveVehicle[] }>()
}

export async function getVehicles(api: KyInstance): Promise<{ data: VehicleAsset[]; total: number }> {
  return api.get('api/v1/vehicles').json()
}
