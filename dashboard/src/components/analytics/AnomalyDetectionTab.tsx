'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Bin } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export type AnomalyType = 'offline' | 'critical_fill' | 'urgent_fill' | 'low_battery'

export interface AnomalyBin extends Bin {
  anomaly_types: AnomalyType[]
}

const LOW_BATTERY_THRESHOLD = 20

export function computeAnomalies(bins: Bin[]): AnomalyBin[] {
  return bins
    .map((b) => {
      const types: AnomalyType[] = []
      if (b.status === 'offline')   types.push('offline')
      if (b.status === 'critical')  types.push('critical_fill')
      if (b.status === 'urgent')    types.push('urgent_fill')
      if (b.battery_level_pct != null && b.battery_level_pct < LOW_BATTERY_THRESHOLD) {
        types.push('low_battery')
      }
      return { ...b, anomaly_types: types }
    })
    .filter((b) => b.anomaly_types.length > 0)
    .sort((a, b) => {
      const priority: Record<AnomalyType, number> = {
        offline: 0, critical_fill: 1, urgent_fill: 2, low_battery: 3,
      }
      const aPri = Math.min(...a.anomaly_types.map((t) => priority[t]))
      const bPri = Math.min(...b.anomaly_types.map((t) => priority[t]))
      return aPri !== bPri ? aPri - bPri : b.urgency_score - a.urgency_score
    })
}

const ANOMALY_META: Record<AnomalyType, { label: string; className: string }> = {
  offline:       { label: 'Offline',       className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  critical_fill: { label: 'Critical Fill', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  urgent_fill:   { label: 'Urgent Fill',   className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  low_battery:   { label: 'Low Battery',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
}

const FILTER_OPTIONS: { value: AnomalyType | 'all'; label: string }[] = [
  { value: 'all',           label: 'All'           },
  { value: 'offline',       label: 'Offline'       },
  { value: 'critical_fill', label: 'Critical Fill' },
  { value: 'urgent_fill',   label: 'Urgent Fill'   },
  { value: 'low_battery',   label: 'Low Battery'   },
]

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className={`text-3xl font-bold tabular-nums ${className ?? ''}`}>{value}</span>
      </CardContent>
    </Card>
  )
}

function AnomalyBadge({ type }: { type: AnomalyType }) {
  const { label, className } = ANOMALY_META[type]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function fillColor(pct: number) {
  if (pct >= 90) return 'text-red-500'
  if (pct >= 75) return 'text-orange-500'
  return ''
}

function batteryColor(pct: number | null) {
  if (pct == null) return 'text-muted-foreground'
  if (pct < 10)   return 'text-red-500'
  if (pct < 20)   return 'text-orange-500'
  return ''
}

interface AnomalyDetectionTabProps {
  bins:       Bin[]
  isLoading?: boolean
  binsTotal?: number  // total bins fetched (for distinguishing empty store vs healthy fleet)
}

export function AnomalyDetectionTab({ bins, isLoading, binsTotal }: AnomalyDetectionTabProps) {
  const [filter, setFilter] = useState<AnomalyType | 'all'>('all')

  const anomalousBins = useMemo(() => computeAnomalies(bins), [bins])

  const summary = useMemo(() => ({
    total:         anomalousBins.length,
    offline:       anomalousBins.filter((b) => b.anomaly_types.includes('offline')).length,
    critical_fill: anomalousBins.filter((b) => b.anomaly_types.includes('critical_fill')).length,
    urgent_fill:   anomalousBins.filter((b) => b.anomaly_types.includes('urgent_fill')).length,
    low_battery:   anomalousBins.filter((b) => b.anomaly_types.includes('low_battery')).length,
  }), [anomalousBins])

  const filtered = useMemo(
    () => filter === 'all' ? anomalousBins : anomalousBins.filter((b) => b.anomaly_types.includes(filter)),
    [anomalousBins, filter],
  )

  const countFor = (v: AnomalyType | 'all') =>
    v === 'all'           ? summary.total
    : v === 'offline'       ? summary.offline
    : v === 'critical_fill' ? summary.critical_fill
    : v === 'urgent_fill'   ? summary.urgent_fill
    : summary.low_battery

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Anomalies"  value={summary.total}         className="text-foreground" />
        <StatCard label="Sensor Offline"   value={summary.offline}       className="text-slate-500" />
        <StatCard label="Critical Fill"    value={summary.critical_fill} className="text-red-500" />
        <StatCard label="Low Battery"      value={summary.low_battery}   className="text-yellow-500" />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors
                ${active
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {opt.label}
              <Badge variant="outline" className="h-4 px-1 text-[10px] font-semibold">
                {countFor(opt.value)}
              </Badge>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground animate-pulse">
              Loading bin data…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {anomalousBins.length === 0
                ? 'No anomalies detected across all bins.'
                : 'No bins match this filter.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bin ID</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Anomaly Types</TableHead>
                  <TableHead className="text-right">Fill %</TableHead>
                  <TableHead className="text-right">Battery %</TableHead>
                  <TableHead className="text-right">Urgency</TableHead>
                  <TableHead>Last Reading</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((bin) => (
                  <TableRow key={bin.bin_id} className="hover:bg-accent/50">
                    <TableCell className="font-mono text-xs font-medium">{bin.bin_id}</TableCell>
                    <TableCell className="text-xs">
                      {bin.zone_name || `Zone ${bin.zone_id}`}
                      {bin.cluster_name && (
                        <span className="block text-muted-foreground">{bin.cluster_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {bin.anomaly_types.map((t) => (
                          <AnomalyBadge key={t} type={t} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${fillColor(bin.fill_level_pct)}`}>
                      {bin.fill_level_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${batteryColor(bin.battery_level_pct)}`}>
                      {bin.battery_level_pct != null ? `${Number(bin.battery_level_pct).toFixed(0)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{bin.urgency_score}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(bin.last_reading_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
