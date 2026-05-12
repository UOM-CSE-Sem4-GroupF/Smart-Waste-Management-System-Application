'use client'

import { useJobStore } from '@/store/jobStore'
import { JobStateStepper } from '@/components/jobs/JobStateStepper'
import type { CollectionJobDetail, JobState } from '@/types'
import { cn } from '@/lib/utils'

const BIN_STATUS_STYLES = {
  pending:   'text-muted-foreground',
  collected: 'text-green-600 dark:text-green-400',
  skipped:   'text-orange-500 dark:text-orange-400',
}

export function JobDetailClient({ initial }: { initial: CollectionJobDetail }) {
  const progress = useJobStore((s) => s.jobProgress.get(initial.job_id))

  // Merge live state
  const state = (progress?.state ?? initial.state) as JobState

  // Build live bin statuses map from job:progress waypoints
  const liveBinStatus: Record<string, 'collected' | 'skipped' | 'pending'> = {}
  if (progress) {
    progress.waypoints.forEach((wp) => {
      wp.bins.forEach((binId) => {
        liveBinStatus[binId] = wp.status === 'completed' ? 'collected' : wp.status === 'current' ? 'pending' : 'pending'
      })
    })
  }

  return (
    <div className="space-y-8">
      {/* State stepper */}
      <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">State Machine</h3>
        <JobStateStepper state={state} />
      </section>

      {/* Bin collection progress */}
      <section className="rounded-xl border border-border bg-background shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">Bin Collection Progress</h3>
          {progress && (
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.bins_collected}/{progress.total_bins} bins ·{' '}
              {progress.cargo_weight_kg.toFixed(1)}/{progress.cargo_limit_kg} kg
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left">Seq</th>
                <th className="px-4 py-2 text-left">Cluster</th>
                <th className="px-4 py-2 text-left">Bin ID</th>
                <th className="px-4 py-2 text-left">Waste Type</th>
                <th className="px-4 py-2 text-right">Est. Weight</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-left">Collected At</th>
              </tr>
            </thead>
            <tbody>
              {(initial.bin_collections ?? []).map((bc) => {
                const raw = liveBinStatus[bc.bin_id] ?? bc.status
                const displayStatus: 'collected' | 'skipped' | 'pending' =
                  raw === 'collected' ? 'collected' : raw === 'skipped' ? 'skipped' : 'pending'
                return (
                  <tr key={`${bc.bin_id}-${bc.sequence_number}`} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 tabular-nums">{bc.sequence_number}</td>
                    <td className="px-4 py-2">{bc.cluster_id}</td>
                    <td className="px-4 py-2 font-medium">{bc.bin_id}</td>
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {bc.estimated_weight_kg.toFixed(1)} kg
                    </td>
                    <td className={cn('px-4 py-2 text-center font-medium capitalize', BIN_STATUS_STYLES[displayStatus])}>
                      {displayStatus === 'collected' ? '✓ Collected' : displayStatus === 'skipped' ? '✗ Skipped' : 'Pending'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {bc.collected_at
                        ? new Date(bc.collected_at).toLocaleTimeString()
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* State history timeline */}
      {initial.state_history.length > 0 && (
        <section className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">State History</h3>
          <ol className="space-y-3">
            {initial.state_history.map((entry, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500 ring-2 ring-background ring-offset-1" />
                <div>
                  <span className="font-medium">
                    {entry.from_state ? `${entry.from_state} → ` : ''}{entry.to_state}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    by {entry.actor} · {new Date(entry.transitioned_at).toLocaleString()}
                  </span>
                  {entry.reason && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
