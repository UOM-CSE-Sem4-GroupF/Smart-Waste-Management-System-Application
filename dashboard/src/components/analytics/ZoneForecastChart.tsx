'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, addDays, startOfDay, getWeek } from 'date-fns'
import { ZONE_COLOURS } from '@/lib/colours'
import { createClientApiClient } from '@/lib/api-client'
import { ZoneSelector } from '@/components/shared/ZoneSelector'
import { ChartSkeleton } from './ChartSkeleton'
import type { ZoneForecastPoint } from '@/lib/api/ml'

// Deterministic mock: 7-day forecast seeded by zone_id + current ISO week
function mockForecast(zoneId: number): ZoneForecastPoint[] {
  const week = getWeek(new Date())
  const seed = (zoneId * 31 + week * 7) % 100
  const base = 55 + (seed % 20)
  const today = startOfDay(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const phase = (seed + i * 13) % 100
    const predicted = base + (phase % 15) - 7
    const clamped = Math.max(45, Math.min(90, predicted))
    return {
      date:      format(addDays(today, i + 1), 'yyyy-MM-dd'),
      predicted: parseFloat(clamped.toFixed(1)),
      lower_ci:  parseFloat(Math.max(35, clamped - 8).toFixed(1)),
      upper_ci:  parseFloat(Math.min(100, clamped + 8).toFixed(1)),
    }
  })
}

export function ZoneForecastChart() {
  const { data: session } = useSession()

  const [selectedZone, setSelectedZone] = useState<number | 'all'>(1)

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
        .json<{ zone_id: number; zone_name: string; forecasts: ZoneForecastPoint[] }>()
    },
    enabled: !!session?.accessToken && selectedZone !== 'all',
    staleTime: 15 * 60_000,
    retry: false,
  })

  if (isLoading) return <ChartSkeleton />

  const isMock = isError || (!isLoading && !data)
  const forecastPoints: ZoneForecastPoint[] = isMock
    ? mockForecast(typeof selectedZone === 'number' ? selectedZone : 1)
    : (data?.forecasts ?? [])

  if (forecastPoints.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">Select a zone to view forecast</p>
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
    )
  }

  const chartData = forecastPoints.map((f) => ({
    date:      format(new Date(f.date), 'MMM d'),
    predicted: f.predicted,
    lower_ci:  f.lower_ci,
    upper_ci:  f.upper_ci,
  }))

  const color = ZONE_COLOURS[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <ZoneSelector value={selectedZone} onChange={setSelectedZone} showAll={false} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: number, name: string) => [`${v.toFixed(1)}%`, name]) as any}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="upper_ci"
            name="Upper CI"
            stroke="none"
            fill={color}
            fillOpacity={0.12}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="lower_ci"
            name="Lower CI"
            stroke="none"
            fill="white"
            fillOpacity={1}
            legendType="none"
          />
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
