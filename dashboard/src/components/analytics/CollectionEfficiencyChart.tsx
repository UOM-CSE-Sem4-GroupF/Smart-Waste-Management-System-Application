'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { ChartSkeleton } from './ChartSkeleton'
import type { CollectionJob, CollectionJobListItem } from '@/types'

interface CollectionEfficiencyChartProps {
  jobs?:      (CollectionJob | CollectionJobListItem)[]
  isLoading?: boolean
}

interface ChartPoint {
  date:    string
  planned: number  // minutes
  actual:  number  // minutes
}

export function CollectionEfficiencyChart({ jobs, isLoading }: CollectionEfficiencyChartProps) {
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!jobs || jobs.length === 0) return []

    const completed = jobs.filter((j) => j.state === 'COMPLETED' || j.state === 'AUDIT_RECORDED')
    const source = completed.length > 0
      ? completed
      : jobs.filter((j) => j.state !== 'CANCELLED' && j.state !== 'FAILED' && j.state !== 'AUDIT_FAILED')

    return source
      .slice(-14)
      .map((job, idx) => {
        const created = (job as CollectionJobListItem).created_at
        const date = created
          ? new Date(created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          : `Job ${idx + 1}`

        const totalBins = (job as CollectionJob).total_bins
          ?? (job as CollectionJobListItem).bins_total
          ?? 10
        const planned = totalBins * 3

        // CollectionJobListItem uses actual_duration_min; CollectionJob uses duration_minutes
        const actual = (job as CollectionJobListItem).actual_duration_min
          ?? (job as CollectionJob).duration_minutes
          ?? planned

        return { date, planned, actual: Math.round(actual) }
      })
  }, [jobs])

  if (isLoading) return <ChartSkeleton />

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No completed jobs available for efficiency analysis
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
          name="Actual duration"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
