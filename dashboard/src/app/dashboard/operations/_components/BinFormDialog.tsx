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
import type { BinUpdatePayload } from '@/types'

const WASTE_CATEGORIES = ['food_waste', 'recyclable', 'general', 'hazardous', 'green_waste']
const STATUSES = ['normal', 'monitor', 'urgent', 'critical', 'offline']

const schema = z.object({
  bin_id:         z.string().min(1, 'Bin ID is required'),
  zone_id:        z.coerce.number().min(1, 'Zone is required'),
  cluster_id:     z.string().optional(),
  address:        z.string().min(1, 'Address is required'),
  latitude:       z.coerce.number(),
  longitude:      z.coerce.number(),
  waste_category: z.string().min(1, 'Category is required'),
  capacity_kg:    z.coerce.number().positive('Must be positive'),
  install_date:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:        boolean
  onClose:     () => void
  bin?:        Partial<BinUpdatePayload>
  zoneOptions: Array<{ id: number; name: string }>
}

export function BinFormDialog({ open, onClose, bin, zoneOptions }: Props) {
  const isEdit = !!bin?.bin_id
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bin_id:         bin?.bin_id ?? '',
      zone_id:        bin?.zone_id ?? undefined,
      address:        bin?.address ?? '',
      latitude:       bin?.lat ?? 0,
      longitude:      bin?.lng ?? 0,
      waste_category: bin?.waste_category ?? '',
      capacity_kg:    bin?.capacity_kg ?? 50,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        bin_id:         bin?.bin_id ?? '',
        zone_id:        bin?.zone_id,
        address:        bin?.address ?? '',
        latitude:       bin?.lat ?? 0,
        longitude:      bin?.lng ?? 0,
        waste_category: bin?.waste_category ?? '',
        capacity_kg:    bin?.capacity_kg ?? 50,
      })
    }
  }, [open, bin, reset])

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (values: FormValues) => {
      const api = createClientApiClient(session!.accessToken)
      if (isEdit) {
        return api.patch(`api/v1/bins/${values.bin_id}`, { json: values }).json()
      }
      return api.post('api/v1/bins', { json: values }).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Bin ${bin?.bin_id}` : 'Add New Bin'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="bin_id">Bin ID*</Label>
              <Input id="bin_id" {...register('bin_id')} readOnly={isEdit} />
              {errors.bin_id && <p className="text-xs text-red-500">{errors.bin_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Zone*</Label>
              <Select
                defaultValue={bin?.zone_id?.toString()}
                onValueChange={(v) => setValue('zone_id', parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((z) => (
                    <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.zone_id && <p className="text-xs text-red-500">{errors.zone_id.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="address">Address*</Label>
            <Input id="address" {...register('address')} />
            {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="latitude">Latitude*</Label>
              <Input id="latitude" type="number" step="any" {...register('latitude')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="longitude">Longitude*</Label>
              <Input id="longitude" type="number" step="any" {...register('longitude')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Waste Category*</Label>
              <Select
                defaultValue={bin?.waste_category}
                onValueChange={(v) => setValue('waste_category', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {WASTE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.waste_category && <p className="text-xs text-red-500">{errors.waste_category.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="capacity_kg">Capacity (kg)*</Label>
              <Input id="capacity_kg" type="number" {...register('capacity_kg')} />
              {errors.capacity_kg && <p className="text-xs text-red-500">{errors.capacity_kg.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="install_date">Install Date</Label>
            <Input id="install_date" type="date" {...register('install_date')} />
          </div>

          {error && <p className="text-sm text-red-500">{(error as Error).message}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Bin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
