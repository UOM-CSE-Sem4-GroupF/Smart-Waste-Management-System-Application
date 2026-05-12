'use client'

import type { BinStatus } from '@/types/bin'
import { STATUS_COLORS } from '@/lib/colours'

interface FillGaugeProps {
  value:  number  // 0–100
  status: BinStatus
  size?:  number  // px, default 80
  label?: string  // shown below gauge, default "{value}%"
}

export function FillGauge({ value, status, size = 80, label }: FillGaugeProps) {
  const radius      = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const filled      = Math.max(0, Math.min(100, value))
  const dashOffset  = circumference - (filled / 100) * circumference
  const color       = STATUS_COLORS[status]
  const cx          = size / 2
  const cy          = size / 2

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-muted"
        />
        {/* Fill arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
        {/* Inner text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-sm font-bold"
          fontSize={size < 60 ? 10 : 13}
          fontWeight="bold"
        >
          {filled}%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground"
          fontSize={size < 60 ? 8 : 10}
        >
          {status}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  )
}
