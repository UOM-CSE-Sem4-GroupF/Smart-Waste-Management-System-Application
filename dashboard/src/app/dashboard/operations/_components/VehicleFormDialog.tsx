'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import type { VehicleAsset } from '@/types'

const VEHICLE_TYPES = ['Garbage Truck', 'Compactor', 'Mini Truck', 'Electric Van', 'Tractor']

const schema = z.object({
  vehicle_id:   z.string().min(1, 'Vehicle ID is required'),
  vehicle_type: z.string().min(1, 'Type is required'),
  capacity_kg:  z.coerce.number().positive('Must be positive'),
  registration: z.string().min(1, 'Registration is required'),
  year:         z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:     boolean
  onClose:  () => void
  vehicle?: Partial<VehicleAsset>
}

export function VehicleFormDialog({ open, onClose, vehicle }: Props) {
  const isEdit = !!vehicle?.vehicle_id
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id:   vehicle?.vehicle_id   ?? '',
      vehicle_type: vehicle?.vehicle_type ?? '',
      capacity_kg:  vehicle?.capacity_kg  ?? 8000,
      registration: vehicle?.registration ?? '',
      year:         vehicle?.year         ?? new Date().getFullYear(),
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        vehicle_id:   vehicle?.vehicle_id   ?? '',
        vehicle_type: vehicle?.vehicle_type ?? '',
        capacity_kg:  vehicle?.capacity_kg  ?? 8000,
        registration: vehicle?.registration ?? '',
        year:         vehicle?.year         ?? new Date().getFullYear(),
      })
    }
  }, [open, vehicle, reset])

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (values: FormValues) => {
      const api = createClientApiClient(session!.accessToken)
      if (isEdit) {
        return api.patch(`api/v1/vehicles/${values.vehicle_id}`, { json: values }).json()
      }
      return api.post('api/v1/vehicles', { json: values }).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
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
                defaultValue={vehicle?.vehicle_type}
                onValueChange={(v) => setValue('vehicle_type', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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

          <div className="space-y-1">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" {...register('year')} />
            {errors.year && <p className="text-xs text-red-500">{errors.year.message}</p>}
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
