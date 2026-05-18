'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BinsTab } from '../operations/_components/BinsTab'
import { VehiclesTab } from '../operations/_components/VehiclesTab'
import { DriversTab } from '../operations/_components/DriversTab'

export default function OperationsNewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A fresh, clean slate for the management panel.
        </p>
      </div>

      <Tabs defaultValue="bins">
        <TabsList>
          <TabsTrigger value="bins">Bins</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="bins" className="mt-4">
          <BinsTab zoneOptions={[]} />
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <VehiclesTab driverOptions={[]} />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DriversTab zoneOptions={[]} vehicleOptions={[]} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
