'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { ChartSkeleton } from './ChartSkeleton'

interface CategoryDataPoint {
  name:     string   // display label
  bins:     number   // bin count
  kg:       number   // total weight
}

interface WasteCategoryChartProps {
  data?:      CategoryDataPoint[]
  isLoading?: boolean
  onBarClick?: (category: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'food waste':    '#22c55e',
  'food_waste':    '#22c55e',
  paper:           '#3b82f6',
  plastic:         '#f97316',
  glass:           '#06b6d4',
  metal:           '#8b5cf6',
  general:         '#6b7280',
  organic:         '#84cc16',
  electronic:      '#ec4899',
}

function getColor(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, '_')
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS[name.toLowerCase()] ?? '#94a3b8'
}

export function WasteCategoryChart({ data, isLoading, onBarClick }: WasteCategoryChartProps) {
  if (isLoading) return <ChartSkeleton />

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No category data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 20, bottom: 4, left: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis type="number" tickFormatter={(v) => `${v} kg`} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={76}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: number) => [`${value} kg`, 'Weight']) as any}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="kg"
          radius={[0, 4, 4, 0]}
          cursor={onBarClick ? 'pointer' : 'default'}
          onClick={onBarClick ? (item) => onBarClick(item.name ?? '') : undefined}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={getColor(entry.name)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
