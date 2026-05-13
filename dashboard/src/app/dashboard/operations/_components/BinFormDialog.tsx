'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CoreCluster, CoreWasteCategory, HierarchyBin, ZoneOption } from '@/lib/api/metadata'
import { ClusterFormFields, type ClusterFormValues } from './ClusterFormDialog'
import { ZoneFormFields, type ZoneFormValues } from './ZoneFormDialog'

const schema = z.object({
  id: z.string().min(1, 'Bin ID is required'),
  zone_id: z.coerce.number().min(1, 'Zone is required'),
  cluster_mode: z.enum(['existing', 'new']),
  cluster_id: z.string().optional(),
  waste_category_id: z.coerce.number().min(1, 'Waste category is required'),
  volume_litres: z.coerce.number().positive('Volume must be positive'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  address: z.string().optional(),
  depth_cm: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
})

type BinFormInput = z.input<typeof schema>
export type BinFormValues = z.output<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  bin?: HierarchyBin
  zones: ZoneOption[]
  clusters: CoreCluster[]
  wasteCategories: CoreWasteCategory[]
  initialZoneId?: number
  initialClusterId?: string
  onSubmit: (
    values: BinFormValues,
    inline: { zone?: ZoneFormValues; cluster?: ClusterFormValues },
  ) => void
  isPending?: boolean
  error?: Error | null
}

export function BinFormDialog({
  open,
  onClose,
  bin,
  zones,
  clusters,
  wasteCategories,
  initialZoneId,
  initialClusterId,
  onSubmit,
  isPending,
  error,
}: Props) {
  const isEdit = !!bin
  const [zoneMode, setZoneMode] = useState<'existing' | 'new'>('existing')
  const [newZone, setNewZone] = useState<ZoneFormValues>({
    name: '',
    code: '',
    collection_day: '',
    collection_time: '',
    notes: '',
  })
  const [newCluster, setNewCluster] = useState<ClusterFormValues>({
    id: '',
    zone_id: initialZoneId ?? 0,
    name: '',
    lat: 0,
    lng: 0,
    address: '',
    cluster_type: 'public_space',
    notes: '',
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BinFormInput, unknown, BinFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: bin?.bin_id ?? '',
      zone_id: bin?.zone_id ?? initialZoneId,
      cluster_mode: 'existing',
      cluster_id: bin?.cluster_id ?? initialClusterId,
      waste_category_id: bin?.waste_category_id,
      volume_litres: bin?.volume_litres ?? 240,
      lat: bin?.lat,
      lng: bin?.lng,
      address: bin?.address ?? '',
      depth_cm: bin?.depth_cm ?? undefined,
      notes: bin?.notes ?? '',
    },
  })

  const selectedZoneId = watch('zone_id')
  const clusterMode = watch('cluster_mode')
  const zoneClusters = useMemo(
    () => clusters.filter((cluster) => Number(cluster.zone_id) === Number(selectedZoneId)),
    [clusters, selectedZoneId],
  )

  useEffect(() => {
    if (!open) return
    const zoneId = bin?.zone_id ?? initialZoneId ?? zones[0]?.id
    reset({
      id: bin?.bin_id ?? '',
      zone_id: zoneId,
      cluster_mode: 'existing',
      cluster_id: bin?.cluster_id ?? initialClusterId,
      waste_category_id: bin?.waste_category_id ?? wasteCategories[0]?.id,
      volume_litres: bin?.volume_litres ?? 240,
      lat: bin?.lat,
      lng: bin?.lng,
      address: bin?.address ?? '',
      depth_cm: bin?.depth_cm ?? undefined,
      notes: bin?.notes ?? '',
    })
    setZoneMode('existing')
    setNewZone({ name: '', code: '', collection_day: '', collection_time: '', notes: '' })
    setNewCluster({
      id: '',
      zone_id: zoneId ?? 0,
      name: '',
      lat: bin?.lat ?? 0,
      lng: bin?.lng ?? 0,
      address: bin?.address ?? '',
      cluster_type: 'public_space',
      notes: '',
    })
  }, [open, bin, initialZoneId, initialClusterId, reset, zones, wasteCategories])

  useEffect(() => {
    if (clusterMode === 'new') {
      setNewCluster((current) => ({ ...current, zone_id: Number(selectedZoneId) || current.zone_id }))
    }
  }, [clusterMode, selectedZoneId])

  const submit = (values: BinFormValues) => {
    onSubmit(values, {
      zone: zoneMode === 'new' ? newZone : undefined,
      cluster: values.cluster_mode === 'new' ? newCluster : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${bin.bin_id}` : 'Create Bin'}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure bin location, waste category, and capacity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-5 py-2">
          {!isEdit && (
            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Zone</h3>
                  <p className="text-xs text-muted-foreground">Choose the parent zone or create one first.</p>
                </div>
                <Select value={zoneMode} onValueChange={(value) => setZoneMode(value as 'existing' | 'new')}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Existing zone</SelectItem>
                    <SelectItem value="new">New zone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {zoneMode === 'new' ? (
                <ZoneFormFields value={newZone} onChange={setNewZone} />
              ) : (
                <div className="space-y-1">
                  <Label>Zone*</Label>
                  <Select
                    value={selectedZoneId ? String(selectedZoneId) : undefined}
                    onValueChange={(value) => {
                      setValue('zone_id', Number(value), { shouldValidate: true })
                      setValue('cluster_id', undefined)
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={String(zone.id)}>{zone.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.zone_id && <p className="text-xs text-red-500">{errors.zone_id.message}</p>}
                </div>
              )}
            </section>
          )}

          {!isEdit && (
            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Cluster</h3>
                  <p className="text-xs text-muted-foreground">A bin must belong to a cluster inside the selected zone.</p>
                </div>
                <Select
                  value={clusterMode}
                  onValueChange={(value) => {
                    setValue('cluster_mode', value as 'existing' | 'new', { shouldValidate: true })
                    if (value === 'new') setValue('cluster_id', undefined)
                  }}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Existing cluster</SelectItem>
                    <SelectItem value="new">New cluster</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {clusterMode === 'new' ? (
                <ClusterFormFields
                  value={{ ...newCluster, zone_id: zoneMode === 'new' ? newCluster.zone_id : Number(selectedZoneId) }}
                  onChange={setNewCluster}
                  zones={zones}
                  lockZone={zoneMode === 'new' || !!selectedZoneId}
                />
              ) : (
                <div className="space-y-1">
                  <Label>Cluster*</Label>
                  <Select
                    value={watch('cluster_id') ?? undefined}
                    onValueChange={(value) => setValue('cluster_id', value, { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                    <SelectContent>
                      {zoneClusters.map((cluster) => (
                        <SelectItem key={cluster.id} value={cluster.id}>{cluster.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {zoneClusters.length === 0 && (
                    <p className="text-xs text-muted-foreground">No clusters in this zone. Switch to New cluster.</p>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-lg border p-3">
            <h3 className="text-sm font-medium">Bin Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="id">Bin ID*</Label>
                <Input id="id" {...register('id')} readOnly={isEdit} />
                {errors.id && <p className="text-xs text-red-500">{errors.id.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Waste category*</Label>
                <Select
                  value={watch('waste_category_id') ? String(watch('waste_category_id')) : undefined}
                  onValueChange={(value) => setValue('waste_category_id', Number(value), { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {wasteCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.waste_category_id && <p className="text-xs text-red-500">{errors.waste_category_id.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="volume_litres">Volume (litres)*</Label>
                <Input id="volume_litres" type="number" {...register('volume_litres')} />
                {errors.volume_litres && <p className="text-xs text-red-500">{errors.volume_litres.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="depth_cm">Depth (cm)</Label>
                <Input id="depth_cm" type="number" {...register('depth_cm')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="any" {...register('lat')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="any" {...register('lng')} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" {...register('address')} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" {...register('notes')} />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error.message}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Bin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
