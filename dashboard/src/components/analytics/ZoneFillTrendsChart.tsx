'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ZONE_COLOURS } from '@/lib/colours'
import { ChartSkeleton } from './ChartSkeleton'

interface TrendDataPoint {
  date:   string         // ISO date string
  [zoneKey: string]: number | string  // zone_id → avg fill %
}

interface ZoneFillTrendsChartProps {
  data?:      TrendDataPoint[]   // array of { date, zone_1: 42, zone_2: 67, ... }
  zoneNames?: Record<string, string>  // zone key → display name
  isLoading?: boolean
}

interface TooltipPayload {
  name:  string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: TooltipPayload[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-card p-2 shadow-lg ring-1 ring-border text-xs">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
    </div>
  )
}

export function ZoneFillTrendsChart({ data, zoneNames, isLoading }: ZoneFillTrendsChartProps) {
  if (isLoading) return <ChartSkeleton />

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No trend data available for selected period
      </div>
    )
  }

  // Derive zone keys from first record (exclude 'date')
  const zoneKeys = useMemo(() => {
    if (!data[0]) return []
    return Object.keys(data[0]).filter((k) => k !== 'date')
  }, [data])

  const formattedData = data.map((d) => ({
    ...d,
    date: format(parseISO(d.date as string), 'MMM d'),
  }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={formattedData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => zoneNames?.[value] ?? value.replace('zone_', 'Zone ')}
          wrapperStyle={{ fontSize: 11 }}
        />
        {zoneKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={zoneNames?.[key] ?? key.replace('zone_', 'Zone ')}
            stroke={ZONE_COLOURS[i % ZONE_COLOURS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
