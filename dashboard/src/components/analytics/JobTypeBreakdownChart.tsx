'use client'

import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { CollectionJobListItem } from '@/types'

interface Props {
  jobs: CollectionJobListItem[]
}

const TYPE_COLORS: Record<string, string> = {
  Emergency: '#ef4444',
  Routine:   '#3b82f6',
}

const STATE_COLORS: Record<string, string> = {
  Active:    '#22c55e',
  Completed: '#6b7280',
  Escalated: '#ef4444',
  Cancelled: '#94a3b8',
}

const ACTIVE_STATES = new Set([
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED', 'CLUSTER_ASSEMBLING',
  'CLUSTER_ASSEMBLED', 'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT',
])

export function JobTypeBreakdownChart({ jobs }: Props) {
  const typeData = useMemo(() => {
    let emergency = 0, routine = 0
    for (const j of jobs) {
      if (j.job_type === 'emergency') emergency++
      else routine++
    }
    return [
      { name: 'Emergency', value: emergency },
      { name: 'Routine',   value: routine },
    ].filter(d => d.value > 0)
  }, [jobs])

  const stateData = useMemo(() => {
    let active = 0, completed = 0, escalated = 0, cancelled = 0
    for (const j of jobs) {
      if (j.state === 'COMPLETED' || j.state === 'AUDIT_RECORDED') completed++
      else if (j.state === 'ESCALATED') escalated++
      else if (j.state === 'CANCELLED' || j.state === 'FAILED' || j.state === 'AUDIT_FAILED') cancelled++
      else if (ACTIVE_STATES.has(j.state)) active++
    }
    return [
      { name: 'Active',    value: active },
      { name: 'Completed', value: completed },
      { name: 'Escalated', value: escalated },
      { name: 'Cancelled', value: cancelled },
    ].filter(d => d.value > 0)
  }, [jobs])

  if (jobs.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No job data available
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-center text-muted-foreground mb-1 font-medium">By Type</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={typeData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
            >
              {typeData.map((entry) => (
                <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number, name: string) => [`${v} jobs`, name]) as any}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs text-center text-muted-foreground mb-1 font-medium">By State</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={stateData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
            >
              {stateData.map((entry) => (
                <Cell key={entry.name} fill={STATE_COLORS[entry.name] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number, name: string) => [`${v} jobs`, name]) as any}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
