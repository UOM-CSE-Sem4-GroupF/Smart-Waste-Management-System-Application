'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { createClientApiClient } from '@/lib/api-client'
import { getDrivers, deactivateDriver } from '@/lib/api/drivers'
import { DriverFormDialog } from './DriverFormDialog'
import type { Driver } from '@/types'
import type { VehicleAsset } from '@/types'

interface Props {
  zoneOptions:    Array<{ id: number; name: string }>
  vehicleOptions: Array<Pick<VehicleAsset, 'vehicle_id' | 'vehicle_type'>>
}

export function DriversTab({ zoneOptions, vehicleOptions }: Props) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const [editDriver, setEditDriver] = useState<Partial<Driver> | null>(null)
  const [addOpen,    setAddOpen]    = useState(false)
  const [deactivate, setDeactivate] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => {
      const api = createClientApiClient(session!.accessToken)
      return getDrivers(api)
    },
    enabled: !!session,
  })

  const { mutate: doDeactivate, isPending: deactivating } = useMutation({
    mutationFn: (driverId: string) => {
      const api = createClientApiClient(session!.accessToken)
      return deactivateDriver(api, driverId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      setDeactivate(null)
    },
  })

  const drivers = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Driver
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {['Driver ID', 'Name', 'Phone', 'Zone', 'Vehicle', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-4 bg-muted rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : drivers.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No drivers found.</td></tr>
            ) : (
              drivers.map((d) => (
                <tr key={d.driver_id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{d.driver_id}</td>
                  <td className="px-3 py-2.5">{d.name}</td>
                  <td className="px-3 py-2.5">{d.phone ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {zoneOptions.find((z) => z.id === d.zone_id)?.name ?? d.zone_id ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">{d.vehicle_id ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === 'on_job'
                        ? 'bg-green-100 text-green-800'
                        : d.status === 'available'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {d.status?.replace(/_/g, ' ') ?? 'unknown'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditDriver(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeactivate(d.driver_id)}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DriverFormDialog
        open={addOpen || editDriver !== null}
        onClose={() => { setAddOpen(false); setEditDriver(null) }}
        driver={editDriver ?? undefined}
        zoneOptions={zoneOptions}
        vehicleOptions={vehicleOptions}
      />

      <AlertDialog open={deactivate !== null} onOpenChange={(v) => { if (!v) setDeactivate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate driver {deactivate}?</AlertDialogTitle>
            <AlertDialogDescription>
              This driver will be marked inactive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={deactivating}
              onClick={() => deactivate && doDeactivate(deactivate)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
