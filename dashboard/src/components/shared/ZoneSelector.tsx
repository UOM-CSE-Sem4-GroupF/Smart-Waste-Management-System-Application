'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMapStore } from '@/store/mapStore'

interface ZoneSelectorProps {
  value:     number | 'all'
  onChange:  (value: number | 'all') => void
  showAll?:  boolean
}

export function ZoneSelector({ value, onChange, showAll = true }: ZoneSelectorProps) {
  const zoneStats = useMapStore((s) => s.zoneStats)

  const zones = Array.from(zoneStats.values()).sort((a, b) =>
    a.zone_name.localeCompare(b.zone_name),
  )

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(v === 'all' ? 'all' : parseInt(v, 10))}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue placeholder="Select zone" />
      </SelectTrigger>
      <SelectContent>
        {showAll && (
          <SelectItem value="all" className="text-xs">All zones</SelectItem>
        )}
        {zones.map((z) => (
          <SelectItem key={z.zone_id} value={String(z.zone_id)} className="text-xs">
            {z.zone_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
