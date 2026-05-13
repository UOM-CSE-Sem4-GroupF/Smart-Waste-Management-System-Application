'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClientApiClient } from '@/lib/api-client'
import { createDriver, updateDriver } from '@/lib/api/drivers'
import type { Driver } from '@/types'

const schema = z.object({
  driver_id:  z.string().min(1, 'Driver ID is required'),
  name:       z.string().min(1, 'Name is required'),
  zone_id:    z.coerce.number().optional(),
  vehicle_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:          boolean
  onClose:       () => void
  driver?:       Partial<Driver>
  zoneOptions:   Array<{ id: number; name: string }>
  vehicleOptions: Array<{ vehicle_id: string; vehicle_type: string }>
}

export function DriverFormDialog({ open, onClose, driver, zoneOptions, vehicleOptions }: Props) {
  const isEdit = !!driver?.driver_id
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      driver_id:  driver?.driver_id  ?? '',
      name:       driver?.name       ?? '',
      zone_id:    driver?.zone_id    ?? undefined,
      vehicle_id: driver?.vehicle_id ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        driver_id:  driver?.driver_id  ?? '',
        name:       driver?.name       ?? '',
        zone_id:    driver?.zone_id    ?? undefined,
        vehicle_id: driver?.vehicle_id ?? '',
      })
    }
  }, [open, driver, reset])

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (values: FormValues) => {
      const api = createClientApiClient(session?.accessToken)
      if (isEdit) {
        const { driver_id, ...rest } = values
        return updateDriver(api, driver_id, rest)
      }
      return createDriver(api, {
        driver_id:  values.driver_id,
        name:       values.name,
        zone_id:    values.zone_id,
        vehicle_id: values.vehicle_id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Driver ${driver?.driver_id}` : 'Add New Driver'}</DialogTitle>
          <DialogDescription className="sr-only">
            Enter the driver's name, assigned zone, and vehicle details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="driver_id">Driver ID*</Label>
              <Input id="driver_id" {...register('driver_id')} readOnly={isEdit} />
              {errors.driver_id && <p className="text-xs text-red-500">{errors.driver_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Full Name*</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Assigned Zone</Label>
              <Select
                defaultValue={driver?.zone_id?.toString()}
                onValueChange={(v) => setValue('zone_id', parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((z) => (
                    <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assigned Vehicle</Label>
              <Select
                defaultValue={driver?.vehicle_id ?? '__none__'}
                onValueChange={(v) => setValue('vehicle_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {[{ vehicle_id: '__none__', vehicle_type: '' }, ...vehicleOptions].map((v) => (
                    <SelectItem key={v.vehicle_id} value={v.vehicle_id}>
                      {v.vehicle_id === '__none__' ? 'Unassigned' : `${v.vehicle_id} — ${v.vehicle_type}`}
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
              {isPending ? 'Saving…' : 'Save Driver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
