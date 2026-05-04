'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface EfficiencyPoint {
  label:           string
  planned_km:      number
  actual_km:       number
  on_time_pct:     number
}

interface Props {
  data: EfficiencyPoint[]
}

export function CollectionEfficiency({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No efficiency data yet — complete collection jobs will appear here.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="km" tick={{ fontSize: 11 }} unit=" km" />
        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="km"
          type="monotone"
          dataKey="planned_km"
          name="Planned km"
          stroke="#6b7280"
          strokeDasharray="4 2"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="km"
          type="monotone"
          dataKey="actual_km"
          name="Actual km"
          stroke="#3b82f6"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="on_time_pct"
          name="On-time %"
          stroke="#22c55e"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
