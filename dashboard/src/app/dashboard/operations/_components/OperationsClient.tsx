'use client'

import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BinsTab } from './BinsTab'
import { VehiclesTab } from './VehiclesTab'
import { DriversTab } from './DriversTab'
import { AccountsTab } from './AccountsTab'

interface Props {
  zoneOptions:    Array<{ id: number; name: string }>
  vehicleOptions: Array<{ vehicle_id: string; vehicle_type: string }>
  driverOptions:  Array<{ driver_id: string; name: string }>
}

import { useQuery } from '@tanstack/react-query'
import { createClientApiClient } from '@/lib/api-client'
import { getZones } from '@/lib/api/zones'
import { getVehicles } from '@/lib/api/vehicles'
import { getDrivers } from '@/lib/api/drivers'

export function OperationsClient({ zoneOptions: initialZones, vehicleOptions: initialVehicles, driverOptions: initialDrivers }: Props) {
  const { data: session } = useSession()
  const roles: string[] = (session?.user as { roles?: string[] } | undefined)?.roles ?? []
  const isAdmin = roles.includes('admin')

  // 1. Fetch Zones
  const { data: zones } = useQuery({
    queryKey: ['zones-ops'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await getZones(api)
      return res.data.map(z => ({
        id: Number(z.id ?? z.zone_id),
        name: z.name ?? z.zone_name ?? `Zone ${z.id ?? z.zone_id}`
      }))
    },
    enabled: !!session?.accessToken,
  })

  // 2. Fetch Vehicles
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-ops'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await getVehicles(api)
      return res.data.map(v => ({ vehicle_id: v.vehicle_id, vehicle_type: v.vehicle_type }))
    },
    enabled: !!session?.accessToken,
  })

  // 3. Fetch Drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers-ops'],
    queryFn: async () => {
      const api = createClientApiClient(session?.accessToken)
      const res = await getDrivers(api)
      return res.data.map(d => ({ driver_id: d.driver_id, name: d.name }))
    },
    enabled: !!session?.accessToken,
  })

  const zoneOptions = zones ?? initialZones
  const vehicleOptions = vehicles ?? initialVehicles
  const driverOptions = drivers ?? initialDrivers

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Management panel — add, update, or deactivate assets in the SWMS.
        </p>
      </div>

      <Tabs defaultValue="bins">
        <TabsList>
          <TabsTrigger value="bins">Bins</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          {isAdmin && <TabsTrigger value="accounts">Accounts</TabsTrigger>}
        </TabsList>

        <TabsContent value="bins" className="mt-4">
          <BinsTab zoneOptions={zoneOptions} />
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <VehiclesTab driverOptions={driverOptions} />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DriversTab zoneOptions={zoneOptions} vehicleOptions={vehicleOptions} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="accounts" className="mt-4">
            <AccountsTab zoneOptions={zoneOptions} driverOptions={driverOptions} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
