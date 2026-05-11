'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { createClientApiClient } from '@/lib/api-client'
import { VehicleFormDialog } from './VehicleFormDialog'
import type { VehicleAsset } from '@/types'

interface VehicleListResponse { data: VehicleAsset[]; total: number }

export function VehiclesTab() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const [editVehicle, setEditVehicle] = useState<Partial<VehicleAsset> | null>(null)
  const [addOpen,     setAddOpen]     = useState(false)
  const [deactivate,  setDeactivate]  = useState<string | null>(null)

  const { data, isLoading } = useQuery<VehicleListResponse>({
    queryKey: ['vehicles'],
    queryFn: () => {
      const api = createClientApiClient(session!.accessToken)
      return api.get('api/v1/vehicles').json<VehicleListResponse>()
    },
    enabled: !!session,
  })

  const { mutate: doDeactivate, isPending: deactivating } = useMutation({
    mutationFn: (vehicleId: string) => {
      const api = createClientApiClient(session!.accessToken)
      return api.patch(`api/v1/vehicles/${vehicleId}`, { json: { active: false } }).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setDeactivate(null)
    },
  })

  const vehicles = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Vehicle
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {['Vehicle ID', 'Type', 'Capacity', 'Registration', 'Year', 'Status', 'Actions'].map((h) => (
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
            ) : vehicles.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No vehicles found.</td></tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.vehicle_id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{v.vehicle_id}</td>
                  <td className="px-3 py-2.5">{v.vehicle_type}</td>
                  <td className="px-3 py-2.5">{v.capacity_kg ? `${v.capacity_kg / 1000}t` : '—'}</td>
                  <td className="px-3 py-2.5">{v.registration ?? '—'}</td>
                  <td className="px-3 py-2.5">{v.year ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      v.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {v.status ?? 'unknown'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditVehicle(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeactivate(v.vehicle_id)}
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

      <VehicleFormDialog
        open={addOpen || editVehicle !== null}
        onClose={() => { setAddOpen(false); setEditVehicle(null) }}
        vehicle={editVehicle ?? undefined}
      />

      <AlertDialog open={deactivate !== null} onOpenChange={(v) => { if (!v) setDeactivate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivate}?</AlertDialogTitle>
            <AlertDialogDescription>
              This vehicle will be marked inactive and excluded from job assignments.
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
