'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { createClientApiClient } from '@/lib/api-client'
import { getAnomalies, type AnomalyType, type AnomalyBin } from '@/lib/api/anomalies'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const ANOMALY_META: Record<AnomalyType, { label: string; className: string }> = {
  offline:       { label: 'Offline',        className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  critical_fill: { label: 'Critical Fill',  className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  urgent_fill:   { label: 'Urgent Fill',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  low_battery:   { label: 'Low Battery',    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
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
  const meta = ANOMALY_META[type]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
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
  if (pct < 10) return 'text-red-500'
  if (pct < 20) return 'text-orange-500'
  return ''
}

export function AnomalyDetectionTab() {
  const { data: session } = useSession()
  const [filter, setFilter] = useState<AnomalyType | 'all'>('all')

  const { data, isFetching, error } = useQuery({
    queryKey: ['bins', 'anomalies'],
    queryFn:  () => getAnomalies(createClientApiClient(session?.accessToken)),
    enabled:  !!session?.accessToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  const summary = data?.summary
  const bins: AnomalyBin[] = data?.bins ?? []

  const filtered = filter === 'all'
    ? bins
    : bins.filter((b) => b.anomaly_types.includes(filter))

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Anomalies"  value={summary?.total         ?? 0} className="text-foreground" />
        <StatCard label="Sensor Offline"   value={summary?.offline       ?? 0} className="text-slate-500" />
        <StatCard label="Critical Fill"    value={summary?.critical_fill ?? 0} className="text-red-500" />
        <StatCard label="Low Battery"      value={summary?.low_battery   ?? 0} className="text-yellow-500" />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {FILTER_OPTIONS.map((opt) => {
          const count =
            opt.value === 'all'
              ? (summary?.total ?? 0)
              : opt.value === 'offline'       ? (summary?.offline       ?? 0)
              : opt.value === 'critical_fill' ? (summary?.critical_fill ?? 0)
              : opt.value === 'urgent_fill'   ? (summary?.urgent_fill   ?? 0)
              : opt.value === 'low_battery'   ? (summary?.low_battery   ?? 0)
              : 0
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
                {count}
              </Badge>
            </button>
          )
        })}
        {isFetching && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {error ? (
            <p className="px-6 py-4 text-sm text-destructive">
              Failed to load anomaly data — ensure the bin-status service is running.
            </p>
          ) : filtered.length === 0 && !isFetching ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {bins.length === 0 ? 'No anomalies detected across all bins.' : 'No bins match this filter.'}
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
                      Zone {bin.zone_id}
                      {bin.cluster_name && (
                        <span className="block text-muted-foreground">{bin.cluster_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {bin.anomaly_types.map((t) => (
                          <AnomalyBadge key={t} type={t as AnomalyType} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${fillColor(bin.fill_level_pct)}`}>
                      {bin.fill_level_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${batteryColor(bin.battery_level_pct)}`}>
                      {bin.battery_level_pct != null ? `${bin.battery_level_pct.toFixed(0)}%` : '—'}
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
