'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useMapStore } from '@/store/mapStore'
import { useJobStore } from '@/store/jobStore'
import { useAlertStore } from '@/store/alertStore'
import { StatCard } from '@/components/shared/StatCard'
import { BinStatusBadge } from '@/components/bins/BinStatusBadge'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Trash2, Truck, Briefcase, AlertTriangle,
  Activity, MapPin, CheckCircle2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTIVE_STATES = new Set([
  'CREATED', 'BIN_CONFIRMING', 'BIN_CONFIRMED',
  'CLUSTER_ASSEMBLING', 'CLUSTER_ASSEMBLED',
  'DISPATCHING', 'DISPATCHED', 'DRIVER_NOTIFIED',
  'IN_PROGRESS', 'SPLIT_JOB', 'COMPLETING', 'COLLECTION_DONE', 'RECORDING_AUDIT',
])

const STATUS_COLOURS: Record<string, string> = {
  normal:   'bg-green-500',
  monitor:  'bg-yellow-400',
  urgent:   'bg-orange-500',
  critical: 'bg-red-500',
  offline:  'bg-gray-400',
}

const ALERT_STYLES: Record<string, string> = {
  urgent:    'text-orange-600 dark:text-orange-400',
  deviation: 'text-yellow-600 dark:text-yellow-400',
  escalated: 'text-red-600 dark:text-red-400',
}

export default function OverviewPage() {
  const bins      = useMapStore((s) => s.bins)
  const vehicles  = useMapStore((s) => s.vehicles)
  const zoneStats = useMapStore((s) => s.zoneStats)
  const jobs      = useJobStore((s) => s.jobs)
  const alerts    = useAlertStore((s) => s.alerts)

  // ── Derived bin stats ────────────────────────────────────────────────────
  const binList   = useMemo(() => Array.from(bins.values()), [bins])
  const totalBins = binList.length

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { normal: 0, monitor: 0, urgent: 0, critical: 0, offline: 0 }
    binList.forEach((b) => { counts[b.status] = (counts[b.status] ?? 0) + 1 })
    return counts
  }, [binList])

  const criticalUrgentCount = statusCounts.critical + statusCounts.urgent

  const avgFill = useMemo(() => {
    if (binList.length === 0) return 0
    return binList.reduce((sum, b) => sum + b.fill_level_pct, 0) / binList.length
  }, [binList])

  // ── Derived job stats ────────────────────────────────────────────────────
  const jobList    = useMemo(() => Array.from(jobs.values()), [jobs])
  const activeJobs = jobList.filter((j) => j.state != null && ACTIVE_STATES.has(j.state))
  const doneToday  = jobList.filter(
    (j) => j.state === 'COMPLETED' || j.state === 'AUDIT_RECORDED',
  ).length

  // ── Active vehicles ──────────────────────────────────────────────────────
  const activeVehicleCount = vehicles.size

  // ── Zone stats table ─────────────────────────────────────────────────────
  const zoneRows = useMemo(
    () => Array.from(zoneStats.values()).sort((a, b) => b.critical_bin_count - a.critical_bin_count),
    [zoneStats],
  )

  // ── Recent unacknowledged alerts ─────────────────────────────────────────
  const recentAlerts = useMemo(
    () => alerts.filter((a) => !a.acknowledged).slice(0, 8),
    [alerts],
  )

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide snapshot — updates live via WebSocket
        </p>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Bins"
          value={totalBins}
          sublabel="monitored across all zones"
          icon={<Trash2 className="h-5 w-5" />}
          href="/dashboard/bins"
        />
        <StatCard
          label="Critical / Urgent"
          value={criticalUrgentCount}
          sublabel={totalBins > 0 ? `${((criticalUrgentCount / totalBins) * 100).toFixed(0)}% of fleet` : '—'}
          trend={criticalUrgentCount > 0 ? 'down' : 'neutral'}
          urgent={criticalUrgentCount > 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          href="/dashboard/bins?status=critical"
        />
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          sublabel={`${doneToday} completed today`}
          icon={<Briefcase className="h-5 w-5" />}
          href="/dashboard/jobs"
        />
        <StatCard
          label="Active Vehicles"
          value={activeVehicleCount}
          sublabel="tracking live positions"
          icon={<Truck className="h-5 w-5" />}
          href="/dashboard/map"
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Avg Fill Level"
          value={`${avgFill.toFixed(1)}%`}
          sublabel="fleet-wide average"
          trend={avgFill > 70 ? 'down' : avgFill > 40 ? 'neutral' : 'up'}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Normal"
          value={statusCounts.normal}
          sublabel="bins at normal fill"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Monitor"
          value={statusCounts.monitor}
          sublabel="bins under watch"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Zones"
          value={zoneStats.size}
          sublabel="zones with live data"
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      {/* Bin status breakdown bar */}
      {totalBins > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bin Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Proportional colour bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {(['normal', 'monitor', 'urgent', 'critical', 'offline'] as const).map((s) => {
                const pct = totalBins > 0 ? (statusCounts[s] / totalBins) * 100 : 0
                return pct > 0 ? (
                  <div
                    key={s}
                    className={cn('h-full transition-all', STATUS_COLOURS[s])}
                    style={{ width: `${pct}%` }}
                    title={`${s}: ${statusCounts[s]} (${pct.toFixed(1)}%)`}
                  />
                ) : null
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4">
              {(['normal', 'monitor', 'urgent', 'critical', 'offline'] as const).map((s) => (
                <Link
                  key={s}
                  href={`/dashboard/bins?status=${s}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLOURS[s])} />
                  <span className="capitalize">{s}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {statusCounts[s]}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zone stats table */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zone Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {zoneRows.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                Waiting for zone:stats events…
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Bins</TableHead>
                    <TableHead className="text-right">Avg Fill</TableHead>
                    <TableHead className="text-right">Urgent</TableHead>
                    <TableHead className="text-right">Critical</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zoneRows.map((z) => (
                    <TableRow key={z.zone_id} className="hover:bg-accent/50">
                      <TableCell className="font-medium">{z.zone_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{z.total_bins}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={cn(
                          'font-medium',
                          z.avg_fill_level_pct >= 80 ? 'text-red-500' :
                          z.avg_fill_level_pct >= 60 ? 'text-orange-500' :
                          z.avg_fill_level_pct >= 40 ? 'text-yellow-500' : '',
                        )}>
                          {z.avg_fill_level_pct.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {z.urgent_bin_count > 0 ? (
                          <span className="font-medium text-orange-500">{z.urgent_bin_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {z.critical_bin_count > 0 ? (
                          <span className="font-medium text-red-500">{z.critical_bin_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{z.active_jobs_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent unacknowledged alerts */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Alerts
            </CardTitle>
            {recentAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {recentAlerts.length} unread
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium">All clear</p>
                <p className="text-xs text-muted-foreground">No unacknowledged alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
                    <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', ALERT_STYLES[alert.type])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-xs capitalize', ALERT_STYLES[alert.type])}
                        >
                          {alert.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDistanceToNow(new Date(alert.received_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm">{alert.message}</p>
                    </div>
                    {alert.bin_id && (
                      <Link
                        href={`/dashboard/bins/${alert.bin_id}`}
                        className="shrink-0 text-xs text-green-600 hover:underline dark:text-green-400"
                      >
                        View bin
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active jobs quick list */}
      {activeJobs.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Collection Jobs
            </CardTitle>
            <Link
              href="/dashboard/jobs"
              className="text-xs text-green-600 hover:underline dark:text-green-400"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Bins</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeJobs.slice(0, 8).map((job) => {
                const jobId = job.job_id ?? (job as unknown as { id?: string }).id ?? ''
                return (
                  <TableRow key={jobId} className="hover:bg-accent/50">
                    <TableCell>
                      <Link
                        href={`/dashboard/jobs/${jobId}`}
                        className="font-medium text-green-600 hover:underline dark:text-green-400"
                      >
                        {jobId.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs capitalize',
                          job.job_type === 'emergency'
                            ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
                            : 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
                        )}
                      >
                        {job.job_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {job.state?.replace(/_/g, ' ') ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.driver_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.bins_collected ?? 0} / {job.total_bins ?? '?'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.actual_weight_kg != null
                        ? job.actual_weight_kg.toFixed(1)
                        : (job.planned_weight_kg?.toFixed(1) ?? '—')}
                    </TableCell>
                  </TableRow>
                )
              })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
