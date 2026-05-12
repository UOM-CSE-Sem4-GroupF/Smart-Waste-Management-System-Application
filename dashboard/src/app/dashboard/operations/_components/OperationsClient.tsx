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

export function OperationsClient({ zoneOptions, vehicleOptions, driverOptions }: Props) {
  const { data: session } = useSession()
  const roles: string[] = (session?.user as { roles?: string[] } | undefined)?.roles ?? []
  const isAdmin = roles.includes('admin')

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
          <VehiclesTab />
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
