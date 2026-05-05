import type { KyInstance } from 'ky'
import type { ActiveVehicle } from '@/types'

export async function getActiveVehicles(api: KyInstance) {
  return api.get('api/v1/vehicles/active').json<{ vehicles: ActiveVehicle[] }>()
}
