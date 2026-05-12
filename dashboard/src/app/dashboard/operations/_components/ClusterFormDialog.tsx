'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CoreCluster, ZoneOption } from '@/lib/api/metadata'

export type ClusterFormValues = {
  id: string
  zone_id: number
  name: string
  lat: number
  lng: number
  address?: string
  cluster_type?: string
  notes?: string
}

interface FieldsProps {
  value: ClusterFormValues
  onChange: (value: ClusterFormValues) => void
  zones: ZoneOption[]
  lockZone?: boolean
  isEdit?: boolean
}

export function ClusterFormFields({ value, onChange, zones, lockZone, isEdit }: FieldsProps) {
  const update = (patch: Partial<ClusterFormValues>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="cluster-id">Cluster ID*</Label>
        <Input id="cluster-id" value={value.id} readOnly={isEdit} onChange={(event) => update({ id: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Zone*</Label>
        <Select
          value={value.zone_id ? String(value.zone_id) : undefined}
          disabled={lockZone}
          onValueChange={(next) => update({ zone_id: Number(next) })}
        >
          <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={String(zone.id)}>{zone.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="cluster-name">Cluster name*</Label>
        <Input id="cluster-name" value={value.name} onChange={(event) => update({ name: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-lat">Latitude*</Label>
        <Input id="cluster-lat" type="number" step="any" value={value.lat} onChange={(event) => update({ lat: Number(event.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-lng">Longitude*</Label>
        <Input id="cluster-lng" type="number" step="any" value={value.lng} onChange={(event) => update({ lng: Number(event.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-type">Cluster type</Label>
        <Input id="cluster-type" value={value.cluster_type ?? ''} onChange={(event) => update({ cluster_type: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cluster-address">Address</Label>
        <Input id="cluster-address" value={value.address ?? ''} onChange={(event) => update({ address: event.target.value })} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="cluster-notes">Notes</Label>
        <Input id="cluster-notes" value={value.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  cluster?: CoreCluster
  zones: ZoneOption[]
  value: ClusterFormValues
  onChange: (value: ClusterFormValues) => void
  onSubmit: () => void
  isPending?: boolean
  error?: Error | null
}

export function ClusterFormDialog({ open, onClose, cluster, zones, value, onChange, onSubmit, isPending, error }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cluster ? `Edit ${cluster.name}` : 'Create Cluster'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ClusterFormFields value={value} onChange={onChange} zones={zones} isEdit={!!cluster} />
          {error && <p className="text-sm text-red-500">{error.message}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="button" disabled={isPending} onClick={onSubmit}>
            {isPending ? 'Saving...' : 'Save Cluster'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
