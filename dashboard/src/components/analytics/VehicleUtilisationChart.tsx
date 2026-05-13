'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { ChartSkeleton } from './ChartSkeleton'
import type { CollectionJob, CollectionJobListItem } from '@/types'

interface VehicleUtilisationChartProps {
  jobs?:      (CollectionJob | CollectionJobListItem)[]
  isLoading?: boolean
}

interface UtilisationPoint {
  vehicle_id:   string
  utilisation:  number  // 0–100
  job_count:    number
}

function barColor(pct: number): string {
  if (pct > 85) return '#f97316'   // orange — over-utilised
  if (pct >= 60) return '#22c55e'  // emerald — optimal
  return '#94a3b8'                  // gray — under-utilised
}

export function VehicleUtilisationChart({ jobs, isLoading }: VehicleUtilisationChartProps) {
  const chartData = useMemo<UtilisationPoint[]>(() => {
    if (!jobs || jobs.length === 0) return []

    const byVehicle = new Map<string, { count: number; totalLoad: number }>()

    for (const job of jobs) {
      // CollectionJobListItem has assigned_vehicle_id; CollectionJob has vehicle_id
      const vid = (job as CollectionJobListItem).assigned_vehicle_id ?? (job as CollectionJob).vehicle_id
      if (!vid) continue
      const existing = byVehicle.get(vid) ?? { count: 0, totalLoad: 0 }
      byVehicle.set(vid, {
        count:     existing.count + 1,
        totalLoad: existing.totalLoad,
      })
    }

    const maxJobs = Math.max(...Array.from(byVehicle.values()).map((v) => v.count), 1)

    return Array.from(byVehicle.entries())
      .map(([id, { count }]) => ({
        vehicle_id:  id,
        utilisation: Math.round((count / maxJobs) * 100),
        job_count:   count,
      }))
      .sort((a, b) => b.utilisation - a.utilisation)
      .slice(0, 10)  // top 10 vehicles
  }, [jobs])

  if (isLoading) return <ChartSkeleton />

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No vehicle utilisation data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 20, bottom: 4, left: 70 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="vehicle_id"
          tick={{ fontSize: 10 }}
          width={66}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number, _: string, entry: { payload: UtilisationPoint }) => [
            `${v}% (${entry.payload.job_count} jobs)`, 'Utilisation'
          ]) as any}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="utilisation" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.vehicle_id} fill={barColor(entry.utilisation)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
