'use client'

import { useMemo, useState } from 'react'
import { ChartSkeleton } from './ChartSkeleton'

interface HeatmapDataPoint {
  zone_id:   number
  zone_name: string
  hour:      number   // 0–23
  avg_fill:  number   // 0–100
}

interface FillRateHeatmapProps {
  data?:      HeatmapDataPoint[]
  isLoading?: boolean
}

/** Interpolate from blue (#3b82f6) to red (#ef4444) based on 0–100 value */
function interpolateColor(value: number): string {
  const t = Math.max(0, Math.min(100, value)) / 100
  const r = Math.round(59  + t * (239 - 59))
  const g = Math.round(130 + t * (68  - 130))
  const b = Math.round(246 + t * (68  - 246))
  return `rgb(${r},${g},${b})`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const CELL  = 24  // px per cell

export function FillRateHeatmap({ data, isLoading }: FillRateHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    zone: string; hour: number; fill: number
  } | null>(null)

  const { zones, matrix } = useMemo(() => {
    if (!data || data.length === 0) return { zones: [], matrix: new Map<string, Map<number, number>>() }

    const zoneMap = new Map<number, string>()
    const m = new Map<string, Map<number, number>>()

    for (const d of data) {
      zoneMap.set(d.zone_id, d.zone_name)
      const key = String(d.zone_id)
      if (!m.has(key)) m.set(key, new Map())
      m.get(key)!.set(d.hour, d.avg_fill)
    }

    const sortedZones = Array.from(zoneMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([id, name]) => ({ id, name }))

    return { zones: sortedZones, matrix: m }
  }, [data])

  if (isLoading) return <ChartSkeleton />

  if (zones.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No fill rate data available
      </div>
    )
  }

  const svgWidth  = HOURS.length * CELL + 90
  const svgHeight = zones.length * CELL + 28

  return (
    <div className="relative w-full overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} style={{ fontSize: 10 }}>
        {/* Hour labels */}
        {HOURS.map((h) => (
          <text
            key={h}
            x={90 + h * CELL + CELL / 2}
            y={12}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.6}
          >
            {h % 3 === 0 ? `${h}:00` : ''}
          </text>
        ))}

        {zones.map((zone, rowIdx) => (
          <g key={zone.id}>
            {/* Zone label */}
            <text
              x={85}
              y={28 + rowIdx * CELL + CELL / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill="currentColor"
              opacity={0.8}
            >
              {zone.name.length > 10 ? zone.name.slice(0, 10) + '…' : zone.name}
            </text>
            {/* Cells */}
            {HOURS.map((h) => {
              const fill = matrix.get(String(zone.id))?.get(h) ?? 0
              return (
                <rect
                  key={h}
                  x={90 + h * CELL + 1}
                  y={28 + rowIdx * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={3}
                  fill={interpolateColor(fill)}
                  opacity={fill === 0 ? 0.15 : 0.85}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) =>
                    setTooltip({
                      x: e.clientX, y: e.clientY,
                      zone: zone.name, hour: h, fill,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </g>
        ))}

        {/* Colour scale */}
        <defs>
          <linearGradient id="heatmap-scale" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor="#3b82f6" />
            <stop offset="50%"  stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <rect
          x={90}
          y={svgHeight - 12}
          width={HOURS.length * CELL}
          height={8}
          rx={4}
          fill="url(#heatmap-scale)"
          opacity={0.7}
        />
        <text x={90} y={svgHeight - 14} fill="currentColor" opacity={0.5}>0%</text>
        <text x={90 + HOURS.length * CELL} y={svgHeight - 14} textAnchor="end" fill="currentColor" opacity={0.5}>100%</text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-card px-2 py-1.5 shadow-lg ring-1 ring-border text-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
        >
          <strong>{tooltip.zone}</strong> · {tooltip.hour}:00
          <br />
          <span className="text-muted-foreground">Avg fill: </span>
          <strong>{tooltip.fill.toFixed(1)}%</strong>
        </div>
      )}
    </div>
  )
}
