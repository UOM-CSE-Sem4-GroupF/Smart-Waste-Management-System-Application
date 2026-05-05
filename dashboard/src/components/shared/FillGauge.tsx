'use client'

interface Props {
  value:   number   // 0–100
  size?:   number   // diameter in px, default 64
  label?:  string   // inner label override
}

const COLOURS = [
  { threshold: 80, colour: '#ef4444' },  // critical / red
  { threshold: 60, colour: '#f97316' },  // urgent   / orange
  { threshold: 40, colour: '#eab308' },  // monitor  / yellow
  { threshold:  0, colour: '#22c55e' },  // normal   / green
]

function trackColour(value: number): string {
  return COLOURS.find((c) => value >= c.threshold)?.colour ?? '#6b7280'
}

export function FillGauge({ value, size = 64, label }: Props) {
  const radius      = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset  = circumference * (1 - Math.max(0, Math.min(100, value)) / 100)
  const colour      = trackColour(value)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Fill level ${value.toFixed(0)}%`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-muted/30"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colour}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* Label */}
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize={size * 0.22}
        fontWeight={600}
        fill={colour}
      >
        {label ?? `${Math.round(value)}%`}
      </text>
    </svg>
  )
}
