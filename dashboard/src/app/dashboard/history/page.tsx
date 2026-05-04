'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'
import { createClientApiClient } from '@/lib/api-client'
import { getJobs } from '@/lib/api/jobs'
import { getBin } from '@/lib/api/bins'
import type { CollectionJobListItem, Bin } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import Link from 'next/link'

const TERMINAL_STATES = ['COMPLETED', 'CANCELLED', 'FAILED', 'AUDIT_RECORDED']

function JobStatePill({ state }: { state: string }) {
  const colour =
    state === 'COMPLETED'      ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
    state === 'CANCELLED'      ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' :
    state === 'FAILED'         ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
    state === 'ESCALATED'      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
    state === 'AUDIT_RECORDED' ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400' :
                                 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colour}`}>
      {state}
    </span>
  )
}

interface SearchParams {
  bin_id:    string
  job_id:    string
  zone_id:   string
  date_from: string
  date_to:   string
}

interface HistoryResults {
  jobs:   CollectionJobListItem[]
  bin:    Bin | null
}

export default function HistoryPage() {
  const { data: session } = useSession()
  const isSupervisor = ['supervisor', 'admin'].includes(session?.user?.role ?? '')

  const [params, setParams] = useState<SearchParams>({
    bin_id:    '',
    job_id:    '',
    zone_id:   '',
    date_from: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    date_to:   format(new Date(), 'yyyy-MM-dd'),
  })
  const [results, setResults] = useState<HistoryResults | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSearch = () => {
    if (!session?.accessToken) return
    startTransition(async () => {
      setError(null)
      try {
        const api = createClientApiClient(session.accessToken)

        const [jobsResult, binResult] = await Promise.allSettled([
          getJobs(api, {
            zone_id:   params.zone_id   ? parseInt(params.zone_id) : undefined,
            date_from: params.date_from || undefined,
            date_to:   params.date_to   || undefined,
            limit:     100,
          }),
          params.bin_id ? getBin(api, params.bin_id) : Promise.resolve(null),
        ])

        const jobs = jobsResult.status === 'fulfilled'
          ? jobsResult.value.data.filter((j) =>
              TERMINAL_STATES.includes(j.state) &&
              (!params.job_id || j.id.toLowerCase().includes(params.job_id.toLowerCase()))
            )
          : []

        const bin = binResult.status === 'fulfilled' ? binResult.value : null

        setResults({ jobs, bin })
      } catch (err) {
        setError('Failed to load history. Check your connection.')
        console.error(err)
      }
    })
  }

  const exportCsv = () => {
    if (!results?.jobs.length) return
    const header = 'Date,Zone,Type,State,Driver,Bins,Weight (kg),Duration (min),Blockchain TX'
    const rows = results.jobs.map((j) =>
      [
        j.completed_at ? format(new Date(j.completed_at), 'yyyy-MM-dd HH:mm') : '',
        j.zone_name,
        j.job_type,
        j.state,
        j.assigned_driver_id ?? '',
        j.bins_collected,
        j.actual_weight_kg ?? '',
        j.duration_minutes ?? '',
        '',  // hyperledger_tx_id not in list shape
      ].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `swms-history-${params.date_from}-${params.date_to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Search past collection jobs and bin records</p>
      </div>

      {/* Search form */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="bin-id">Bin ID</Label>
            <Input
              id="bin-id"
              placeholder="BIN-001"
              value={params.bin_id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParams((p) => ({ ...p, bin_id: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-id">Job ID</Label>
            <Input
              id="job-id"
              placeholder="JOB-001"
              value={params.job_id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParams((p) => ({ ...p, job_id: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-id">Zone</Label>
            <Input
              id="zone-id"
              placeholder="Zone ID"
              type="number"
              value={params.zone_id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParams((p) => ({ ...p, zone_id: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-from">Date from</Label>
            <Input
              id="date-from"
              type="date"
              value={params.date_from}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParams((p) => ({ ...p, date_from: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to">Date to</Label>
            <Input
              id="date-to"
              type="date"
              value={params.date_to}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParams((p) => ({ ...p, date_to: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={handleSearch}
              disabled={isPending}
            >
              {isPending ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Jobs results */}
      {results && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Jobs — {results.jobs.length} result{results.jobs.length !== 1 ? 's' : ''}
            </p>
            {isSupervisor && results.jobs.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
            )}
          </div>

          {results.jobs.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
              No completed jobs found for these filters.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Bins</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right">Duration (min)</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.jobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {job.completed_at
                          ? format(new Date(job.completed_at), 'dd MMM yyyy HH:mm')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{job.zone_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.job_type === 'emergency'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {job.job_type}
                        </span>
                      </TableCell>
                      <TableCell><JobStatePill state={job.state} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.assigned_driver_id ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {job.bins_collected}/{job.bins_total}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {job.actual_weight_kg != null ? job.actual_weight_kg.toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {job.duration_minutes ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Bin history results */}
      {results?.bin && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Bin collections — {results.bin.recent_collections?.length ?? 0} record{(results.bin.recent_collections?.length ?? 0) !== 1 ? 's' : ''}
          </p>

          {!results.bin.recent_collections?.length ? (
            <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
              No collection history found for this bin.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Fill at collection (%)</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead>Job type</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.bin.recent_collections.map((c, i) => (
                    <TableRow key={i} className="hover:bg-muted/50">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(c.collected_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{c.job_id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.driver_id}</TableCell>
                      <TableCell className="text-right text-sm">{c.fill_level_at_collection.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {c.actual_weight_kg != null ? c.actual_weight_kg.toFixed(1) : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.job_type === 'emergency'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {c.job_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/jobs/${c.job_id}`}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View job
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
