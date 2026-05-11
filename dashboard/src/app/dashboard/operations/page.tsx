import { createApiClient } from '@/lib/api-client'
import { getZones } from '@/lib/api/zones'
import { getVehicles } from '@/lib/api/vehicles'
import { getDrivers } from '@/lib/api/drivers'
import { OperationsClient } from './_components/OperationsClient'

export default async function OperationsPage() {
  const api     = await createApiClient()

  const [zonesRes, vehiclesRes, driversRes] = await Promise.allSettled([
    getZones(api),
    getVehicles(api),
    getDrivers(api),
  ])

  const zoneOptions = zonesRes.status === 'fulfilled'
    ? zonesRes.value.data.map((z) => ({ id: z.id, name: z.name }))
    : []

  const vehicleOptions = vehiclesRes.status === 'fulfilled'
    ? vehiclesRes.value.data.map((v) => ({ vehicle_id: v.vehicle_id, vehicle_type: v.vehicle_type }))
    : []

  const driverOptions = driversRes.status === 'fulfilled'
    ? driversRes.value.data.map((d) => ({ driver_id: d.driver_id, name: d.name }))
    : []

  return (
    <OperationsClient
      zoneOptions={zoneOptions}
      vehicleOptions={vehicleOptions}
      driverOptions={driverOptions}
    />
  )
}
