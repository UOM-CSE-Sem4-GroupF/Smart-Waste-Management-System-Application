import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createApiClient } from '@/lib/api-client'
import { getJob } from '@/lib/api/jobs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JobDetailClient } from './_components/JobDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params

  const api = await createApiClient()
  let job
  try {
    job = await getJob(api, id)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{job.id.slice(0, 8)}…</h2>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
              job.job_type === 'emergency'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {job.job_type}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Zone: {job.zone_name} · Priority {job.priority} ·
            Created {format(new Date(job.created_at), 'dd MMM yyyy HH:mm')}
          </p>
        </div>
        <Link href="/dashboard/jobs" className="text-xs text-muted-foreground hover:underline">
          ← Back to jobs
        </Link>
      </div>

      {/* Assignment details */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{job.assigned_driver_id ?? 'Unassigned'}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{job.assigned_vehicle_id ?? 'Unassigned'}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Planned Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {job.planned_weight_kg != null ? `${job.planned_weight_kg.toFixed(1)} kg` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Bins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {job.bins_collected}/{job.bins_total} collected · {job.bins_skipped} skipped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Live client section: stepper, bin progress, state history */}
      <JobDetailClient initial={job} />
    </div>
  )
}
