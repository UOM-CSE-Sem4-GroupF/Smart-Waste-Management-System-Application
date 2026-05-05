'use client'

import { X } from 'lucide-react'
import { format } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { STATUS_COLOURS } from '@/lib/mapbox'
import { Button } from '@/components/ui/button'
import type { BinUpdatePayload } from '@/types/bin'

const FILL_COLOURS: Record<string, string> = {
  normal:   'bg-green-500',
  monitor:  'bg-yellow-500',
  urgent:   'bg-orange-500',
  critical: 'bg-red-500',
  offline:  'bg-gray-400',
}

export function BinDetailPanel() {
  const selectedBinId = useMapStore((s) => s.selectedBinId)
  const bins = useMapStore((s) => s.bins) as Map<string, BinUpdatePayload>
  const selectBin = useMapStore((s) => s.selectBin)

  if (!selectedBinId) return null

  const bin = bins.get(selectedBinId)
  if (!bin) return null

  const colour = STATUS_COLOURS[bin.status] ?? STATUS_COLOURS.offline
  const fillClass = FILL_COLOURS[bin.status] ?? FILL_COLOURS.offline

  return (
    <div className="absolute right-4 top-4 z-10 w-80 rounded-xl border bg-background/95 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <p className="text-xs text-muted-foreground">Bin</p>
          <p className="font-semibold">{bin.bin_id}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => selectBin(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 p-3">
        {/* Status + fill */}
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full flex-shrink-0"
            style={{ background: colour }}
          />
          <span className="text-sm capitalize font-medium">{bin.status}</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {bin.fill_level_pct}%
          </span>
        </div>

        {/* Fill bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${fillClass}`}
            style={{ width: `${bin.fill_level_pct}%` }}
          />
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Zone</dt>
          <dd className="font-medium">{bin.zone_id}</dd>

          <dt className="text-muted-foreground">Cluster</dt>
          <dd className="font-medium">{bin.cluster_name}</dd>

          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium capitalize">{bin.waste_category.replace('_', ' ')}</dd>

          <dt className="text-muted-foreground">Est. weight</dt>
          <dd className="font-medium">{bin.estimated_weight_kg} kg</dd>

          <dt className="text-muted-foreground">Battery</dt>
          <dd className="font-medium">{bin.battery_level_pct}%</dd>

          <dt className="text-muted-foreground">Urgency score</dt>
          <dd className="font-medium">{bin.urgency_score.toFixed(1)}</dd>

          {bin.predicted_full_at && (
            <>
              <dt className="text-muted-foreground">Predicted full</dt>
              <dd className="font-medium">
                {format(new Date(bin.predicted_full_at), 'MMM d, HH:mm')}
              </dd>
            </>
          )}

          <dt className="text-muted-foreground">Fill rate</dt>
          <dd className="font-medium">{bin.fill_rate_pct_per_hour?.toFixed(1) ?? '—'}%/h</dd>
        </dl>
      </div>
    </div>
  )
}
