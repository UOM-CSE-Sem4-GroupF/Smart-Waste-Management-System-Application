'use client'

import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { BinHistory } from '@/types'

export function FillHistoryChart({ history }: { history: BinHistory }) {
  const data = history.series.map((s) => ({
    time:    format(new Date(s.timestamp), 'HH:mm'),
    fill:    parseFloat(s.fill_level_pct.toFixed(1)),
    urgency: parseFloat(s.urgency_score.toFixed(1)),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <ReferenceLine y={80} stroke="#f97316" strokeDasharray="4 2" label={{ value: '80% threshold', fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="fill"
          name="Fill %"
          stroke="#22c55e"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
