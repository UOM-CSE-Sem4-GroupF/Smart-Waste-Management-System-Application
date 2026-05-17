'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function OperationsClient({ zoneOptions, vehicleOptions, driverOptions }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Management panel — (Simplified Mode)
        </p>
      </div>

      <Tabs defaultValue="bins">
        <TabsList>
          <TabsTrigger value="bins">Bins</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="bins" className="mt-4 p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Bin management is currently being rebuilt for stability.</p>
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4 p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Vehicle management is currently being rebuilt for stability.</p>
        </TabsContent>

        <TabsContent value="drivers" className="mt-4 p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Driver management is currently being rebuilt for stability.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
