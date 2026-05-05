'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ZoneOption {
  id:   string
  name: string
}

interface Props {
  zones:     ZoneOption[]
  value:     string          // zone id, or 'all'
  onChange:  (value: string) => void
  allLabel?: string
  className?: string
}

export function ZoneSelector({ zones, value, onChange, allLabel = 'All zones', className }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-[160px]'}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {zones.map((z) => (
          <SelectItem key={z.id} value={z.id}>
            {z.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
