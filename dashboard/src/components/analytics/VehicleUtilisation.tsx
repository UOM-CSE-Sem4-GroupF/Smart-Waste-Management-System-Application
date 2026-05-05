'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'

interface VehicleBar {
  vehicle_id:    string
  utilisation:   number   // 0–100 %
}

interface Props {
  data: VehicleBar[]
}

function barColour(util: number): string {
  if (util > 85) return '#f97316'   // orange — overloaded
  if (util >= 60) return '#22c55e'  // green  — healthy
  return '#6b7280'                  // grey   — underused
}

export function VehicleUtilisation({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No vehicle utilisation data yet.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="vehicle_id" width={80} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => {
            const num = typeof v === 'number' ? v : Number(v)
            return [`${num.toFixed(1)}%`, 'Utilisation']
          }}
        />
        <Bar dataKey="utilisation" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.vehicle_id} fill={barColour(entry.utilisation)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
