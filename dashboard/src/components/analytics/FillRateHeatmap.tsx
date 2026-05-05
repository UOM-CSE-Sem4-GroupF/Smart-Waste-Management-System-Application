'use client'

import { useMemo } from 'react'

interface HeatmapCell {
  zone:   string
  hour:   number
  value:  number   // 0–100 fill rate
}

interface Props {
  data: HeatmapCell[]
}

function heatColour(v: number): string {
  // 0 → blue (#3b82f6), 50 → yellow (#eab308), 100 → red (#ef4444)
  if (v < 50) {
    const t = v / 50
    const r = Math.round(59  + t * (234 - 59))
    const g = Math.round(130 + t * (179 - 130))
    const b = Math.round(246 + t * (8   - 246))
    return `rgb(${r},${g},${b})`
  }
  const t = (v - 50) / 50
  const r = Math.round(234 + t * (239 - 234))
  const g = Math.round(179 + t * (68  - 179))
  const b = Math.round(8   + t * (68  - 8))
  return `rgb(${r},${g},${b})`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const CELL_W = 26
const CELL_H = 22
const LABEL_W = 72
const LABEL_H = 24
const PAD_LEFT = 8

export function FillRateHeatmap({ data }: Props) {
  const zones = useMemo(
    () => Array.from(new Set(data.map((d) => d.zone))).sort(),
    [data],
  )

  const lookup = useMemo(() => {
    const m = new Map<string, number>()
    data.forEach((d) => m.set(`${d.zone}:${d.hour}`, d.value))
    return m
  }, [data])

  if (zones.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No heatmap data yet — zone:stats events will populate this.
      </p>
    )
  }

  const svgW = PAD_LEFT + LABEL_W + HOURS.length * CELL_W
  const svgH = LABEL_H + zones.length * CELL_H + 4

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        className="font-sans"
        aria-label="Fill rate heatmap"
      >
        {/* Hour labels */}
        {HOURS.map((h) => (
          <text
            key={h}
            x={PAD_LEFT + LABEL_W + h * CELL_W + CELL_W / 2}
            y={LABEL_H - 6}
            textAnchor="middle"
            fontSize={9}
            className="fill-muted-foreground"
          >
            {h % 4 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
          </text>
        ))}

        {/* Rows */}
        {zones.map((zone, zi) => {
          const y = LABEL_H + zi * CELL_H
          return (
            <g key={zone}>
              {/* Zone label */}
              <text
                x={PAD_LEFT + LABEL_W - 6}
                y={y + CELL_H / 2 + 4}
                textAnchor="end"
                fontSize={10}
                className="fill-foreground"
              >
                {zone}
              </text>

              {/* Cells */}
              {HOURS.map((h) => {
                const v = lookup.get(`${zone}:${h}`) ?? 0
                return (
                  <g key={h}>
                    <title>{`${zone} ${String(h).padStart(2, '0')}:00 — ${v.toFixed(0)}%`}</title>
                    <rect
                      x={PAD_LEFT + LABEL_W + h * CELL_W}
                      y={y}
                      width={CELL_W - 1}
                      height={CELL_H - 1}
                      rx={2}
                      fill={heatColour(v)}
                      opacity={v === 0 ? 0.15 : 0.85}
                    />
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <svg width={120} height={12}>
          <defs>
            <linearGradient id="heat-grad" x1="0" x2="1">
              <stop offset="0%"   stopColor="#3b82f6" />
              <stop offset="50%"  stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <rect width={120} height={12} rx={3} fill="url(#heat-grad)" />
        </svg>
        <span>High</span>
      </div>
    </div>
  )
}
