'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ZoneOption } from '@/lib/api/metadata'

export type ZoneFormValues = {
  name: string
  code: string
  collection_day?: string
  collection_time?: string
  notes?: string
}

interface FieldsProps {
  value: ZoneFormValues
  onChange: (value: ZoneFormValues) => void
}

export function ZoneFormFields({ value, onChange }: FieldsProps) {
  const update = (patch: Partial<ZoneFormValues>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="zone-name">Zone name*</Label>
        <Input id="zone-name" value={value.name} onChange={(event) => update({ name: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zone-code">Zone code*</Label>
        <Input id="zone-code" value={value.code} onChange={(event) => update({ code: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zone-day">Collection day</Label>
        <Input id="zone-day" value={value.collection_day ?? ''} onChange={(event) => update({ collection_day: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zone-time">Collection time</Label>
        <Input id="zone-time" type="time" value={value.collection_time ?? ''} onChange={(event) => update({ collection_time: event.target.value })} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="zone-notes">Notes</Label>
        <Input id="zone-notes" value={value.notes ?? ''} onChange={(event) => update({ notes: event.target.value })} />
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  zone?: ZoneOption
  value: ZoneFormValues
  onChange: (value: ZoneFormValues) => void
  onSubmit: () => void
  isPending?: boolean
  error?: Error | null
}

export function ZoneFormDialog({ open, onClose, zone, value, onChange, onSubmit, isPending, error }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{zone ? `Edit Zone ${zone.id}` : 'Create New Zone'}</DialogTitle>
          <DialogDescription className="sr-only">
            Define the zone name and its geographic boundaries.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ZoneFormFields value={value} onChange={onChange} />
          {error && <p className="text-sm text-red-500">{error.message}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="button" disabled={isPending} onClick={onSubmit}>
            {isPending ? 'Saving...' : 'Save Zone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
