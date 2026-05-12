'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClientApiClient } from '@/lib/api-client'
import { createVehicle, updateVehicle } from '@/lib/api/vehicles'
import type { VehicleAsset } from '@/types'

const VEHICLE_TYPES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'extra_large', label: 'Extra Large' },
]

const VEHICLE_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'decommissioned', label: 'Decommissioned' },
]

const schema = z.object({
  vehicle_id:   z.string().min(1, 'Vehicle ID is required'),
  vehicle_type: z.string().min(1, 'Type is required'),
  capacity_kg:  z.coerce.number().positive('Must be positive'),
  registration: z.string().min(1, 'Registration is required'),
  status:       z.string().min(1, 'Status is required'),
  driver_id:    z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:     boolean
  onClose:  () => void
  vehicle?: Partial<VehicleAsset>
  driverOptions: Array<{ driver_id: string; name: string }>
}

export function VehicleFormDialog({ open, onClose, vehicle, driverOptions }: Props) {
  const isEdit = !!vehicle?.vehicle_id
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      vehicle_id:   vehicle?.vehicle_id   ?? '',
      vehicle_type: vehicle?.vehicle_type ?? 'medium',
      capacity_kg:  vehicle?.capacity_kg  ?? 8000,
      registration: vehicle?.registration ?? '',
      status:       vehicle?.status && vehicle.status !== 'inactive' ? vehicle.status : 'available',
      driver_id:    vehicle?.driver_id ?? '',
    },
  })
  const vehicleType = useWatch({ control, name: 'vehicle_type' })
  const status = useWatch({ control, name: 'status' })
  const driverId = useWatch({ control, name: 'driver_id' })

  useEffect(() => {
    if (open) {
      reset({
        vehicle_id:   vehicle?.vehicle_id   ?? '',
        vehicle_type: vehicle?.vehicle_type ?? 'medium',
        capacity_kg:  vehicle?.capacity_kg  ?? 8000,
        registration: vehicle?.registration ?? '',
        status:       vehicle?.status && vehicle.status !== 'inactive' ? vehicle.status : 'available',
        driver_id:    vehicle?.driver_id ?? '',
      })
    }
  }, [open, vehicle, reset])

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (values: FormValues) => {
      const api = createClientApiClient(session?.accessToken)
      const payload = {
        ...values,
        driver_id: values.driver_id || null,
      }
      if (isEdit) {
        const { vehicle_id, ...rest } = payload
        return updateVehicle(api, vehicle_id, rest)
      }
      return createVehicle(api, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Vehicle ${vehicle?.vehicle_id}` : 'Add New Vehicle'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="vehicle_id">Vehicle ID*</Label>
              <Input id="vehicle_id" {...register('vehicle_id')} readOnly={isEdit} />
              {errors.vehicle_id && <p className="text-xs text-red-500">{errors.vehicle_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Vehicle Type*</Label>
              <Select
                value={vehicleType}
                onValueChange={(v) => setValue('vehicle_type', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vehicle_type && <p className="text-xs text-red-500">{errors.vehicle_type.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="capacity_kg">Capacity (kg)*</Label>
              <Input id="capacity_kg" type="number" {...register('capacity_kg')} />
              {errors.capacity_kg && <p className="text-xs text-red-500">{errors.capacity_kg.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="registration">Registration*</Label>
              <Input id="registration" {...register('registration')} />
              {errors.registration && <p className="text-xs text-red-500">{errors.registration.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue('status', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && <p className="text-xs text-red-500">{errors.status.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Assigned Driver</Label>
              <Select
                value={driverId || '__none__'}
                onValueChange={(v) => setValue('driver_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {driverOptions.map((d) => (
                    <SelectItem key={d.driver_id} value={d.driver_id}>
                      {d.driver_id} - {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{(error as Error).message}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
