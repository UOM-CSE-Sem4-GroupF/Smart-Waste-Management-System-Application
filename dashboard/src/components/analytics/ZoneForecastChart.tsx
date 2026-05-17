'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts'
import { createClientApiClient } from '@/lib/api-client'
import { getZoneGenerationPrediction, type ZoneGenerationPrediction } from '@/lib/api/ml'
import { ZoneSelector } from '@/components/shared/ZoneSelector'
import { ChartSkeleton } from './ChartSkeleton'
import { useMapStore } from '@/store/mapStore'

const CATEGORY_COLORS: Record<string, string> = {
  food_waste: '#22c55e',
  paper:      '#3b82f6',
  plastic:    '#f97316',
  glass:      '#06b6d4',
  general:    '#6b7280',
  e_waste:    '#ec4899',
}

export function ZoneForecastChart() {
  const { data: session } = useSession()
  const zoneStats = useMapStore((s) => s.zoneStats)
  const firstZoneId = zoneStats.size > 0 ? Array.from(zoneStats.keys())[0] : 1

  const [selectedZone, setSelectedZone] = useState<number | 'all'>(firstZoneId)

  const { data, isPending, isError } = useQuery({
    queryKey: ['ml', 'zone-forecast', selectedZone],
    queryFn: () => getZoneGenerationPrediction(
      createClientApiClient(session!.accessToken),
      selectedZone as number,
    ),
    enabled: !!session?.accessToken && selectedZone !== 'all',
    staleTime: 15 * 60_000,
    retry: false,
  })

  if (isPending) return <ChartSkeleton />

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Zone forecast endpoint not yet available
        </p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">Select a zone to view forecast</p>
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
    )
  }

  const prediction = data as ZoneGenerationPrediction
  const chartData = Object.entries(prediction.by_waste_category).map(([cat, kg]) => ({
    name: cat.replace(/_/g, ' '),
    kg:   parseFloat((kg as number).toFixed(1)),
    key:  cat,
  }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Predicted <span className="font-semibold text-foreground">
            {prediction.predicted_kg_per_day.toFixed(0)} kg/day
          </span> over next 7 days
        </p>
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 70 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis type="number" tickFormatter={(v) => `${v} kg`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={66} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: number) => [`${v} kg`, 'Predicted']) as any}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="kg" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] ?? '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
