'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, addDays, startOfDay } from 'date-fns'
import { ZONE_COLOURS } from '@/lib/colours'
import { createClientApiClient } from '@/lib/api-client'
import { ZoneSelector } from '@/components/shared/ZoneSelector'
import { ChartSkeleton } from './ChartSkeleton'
import { useMapStore } from '@/store/mapStore'

interface ZoneForecastDataPoint {
  date:       string
  predicted:  number
  lower_ci:   number
  upper_ci:   number
}

interface ZoneForecastResponse {
  zone_id:    number
  zone_name:  string
  forecasts:  ZoneForecastDataPoint[]
}

export function ZoneForecastChart() {
  const { data: session } = useSession()
  const zoneStats = useMapStore((s) => s.zoneStats)
  const firstZone = Array.from(zoneStats.keys())[0] ?? null

  const [selectedZone, setSelectedZone] = useState<number | 'all'>(firstZone ?? 'all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ml', 'zone-forecast', selectedZone],
    queryFn: async () => {
      const api = createClientApiClient(session!.accessToken)
      return api
        .get('api/v1/ml/predict/zone-generation', {
          searchParams: {
            zone_id:    String(selectedZone),
            date_range: 'next_7_days',
          },
        })
        .json<ZoneForecastResponse>()
    },
    enabled: !!session?.accessToken && selectedZone !== 'all',
    staleTime: 15 * 60_000,
    retry: false,
  })

  if (isLoading) return <ChartSkeleton />

  // Endpoint not available — show graceful empty state
  if (isError || (!isLoading && !data)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Zone forecast endpoint not yet available
        </p>
        <p className="text-xs text-muted-foreground">
          This chart will populate once the ML forecast service exposes
          <code className="mx-1 rounded bg-muted px-1">GET /api/v1/ml/predict/zone-generation</code>
        </p>
      </div>
    )
  }

  if (!data || data.forecasts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">
          Select a zone to view forecast
        </p>
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
    )
  }

  const chartData = data.forecasts.map((f) => ({
    date:      format(new Date(f.date), 'MMM d'),
    predicted: f.predicted,
    ci_band:   [f.lower_ci, f.upper_ci] as [number, number],
    lower_ci:  f.lower_ci,
    upper_ci:  f.upper_ci,
  }))

  const color = ZONE_COLOURS[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: number, name: string) => [`${v.toFixed(1)}%`, name]) as any}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* CI upper band */}
          <Area
            type="monotone"
            dataKey="upper_ci"
            name="Upper CI"
            stroke="none"
            fill={color}
            fillOpacity={0.12}
            legendType="none"
          />
          {/* CI lower band */}
          <Area
            type="monotone"
            dataKey="lower_ci"
            name="Lower CI"
            stroke="none"
            fill="white"
            fillOpacity={1}
            legendType="none"
          />
          {/* Predicted line */}
          <Area
            type="monotone"
            dataKey="predicted"
            name="Predicted fill %"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
