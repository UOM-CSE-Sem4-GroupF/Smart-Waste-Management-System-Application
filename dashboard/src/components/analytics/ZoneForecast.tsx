'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface ForecastPoint {
  date:         string
  [category: string]: string | number
}

interface CategoryMeta {
  key:    string
  label:  string
  colour: string
}

interface Props {
  data:       ForecastPoint[]
  categories: CategoryMeta[]
}

export function ZoneForecast({ data, categories }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No forecast data yet — select a zone and wait for ML predictions.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <defs>
          {categories.map((cat) => (
            <linearGradient key={cat.key} id={`grad-${cat.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={cat.colour} stopOpacity={0.5} />
              <stop offset="95%" stopColor={cat.colour} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit=" kg" />
        <Tooltip />
        <Legend />
        {categories.map((cat) => (
          <Area
            key={cat.key}
            type="monotone"
            dataKey={cat.key}
            name={cat.label}
            stackId="1"
            stroke={cat.colour}
            fill={`url(#grad-${cat.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
