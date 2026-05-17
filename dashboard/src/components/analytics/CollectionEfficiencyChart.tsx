'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChartSkeleton } from './ChartSkeleton'
import type { CollectionJob } from '@/types'

interface CollectionEfficiencyChartProps {
  jobs?:      CollectionJob[]
  isLoading?: boolean
}

interface ChartPoint {
  date:    string
  planned: number  // minutes (estimated from state transitions)
  actual:  number  // minutes (actual_duration_minutes if available)
}

export function CollectionEfficiencyChart({ jobs, isLoading }: CollectionEfficiencyChartProps) {
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!jobs || jobs.length === 0) return []

    // Include all non-cancelled jobs — completed ones have duration; active ones show bins progress
    const active = jobs.filter(
      (j) => j.state !== 'CANCELLED',
    )
    if (active.length === 0) return []

    return active
      .slice(-14)
      .map((job, idx) => {
        const planned = job.total_bins ?? 10
        // For completed jobs prefer duration_minutes; otherwise derive from bins ratio
        const actual = job.duration_minutes != null
          ? job.duration_minutes
          : job.bins_collected != null && planned > 0
            ? Math.round((job.bins_collected / planned) * planned * 3)
            : planned * 3
        return {
          date:    `Job ${idx + 1}`,
          planned: planned * 3,  // 3 min per bin estimate
          actual,
        }
      })
  }, [jobs])

  if (isLoading) return <ChartSkeleton />

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No jobs available for efficiency analysis
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${v}m`} tick={{ fontSize: 11 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number, name: string) => [`${v} min`, name]) as any}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="planned"
          name="Planned duration"
          stroke="#94a3b8"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual / progress"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
