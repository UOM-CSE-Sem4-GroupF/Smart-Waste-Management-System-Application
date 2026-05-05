import { format } from 'date-fns'
import { TableCell, TableRow } from '@/components/ui/table'
import { JobStateBadge } from './JobStateBadge'
import { JobTypeBadge } from './JobTypeBadge'
import { Button } from '@/components/ui/button'
import type { CollectionJobListItem } from '@/types'

interface CompletedJobRowProps {
  job:          CollectionJobListItem
  onViewDetail: (id: string) => void
}

export function CompletedJobRow({ job, onViewDetail }: CompletedJobRowProps) {
  return (
    <TableRow className="hover:bg-muted/50 text-sm">
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {job.completed_at
          ? format(new Date(job.completed_at), 'dd MMM HH:mm')
          : '—'}
      </TableCell>
      <TableCell>{job.zone_name}</TableCell>
      <TableCell><JobTypeBadge type={job.job_type} /></TableCell>
      <TableCell><JobStateBadge state={job.state} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {job.assigned_driver_id ?? '—'}
      </TableCell>
      <TableCell className="text-right">
        {job.bins_collected}/{job.bins_total}
      </TableCell>
      <TableCell className="text-right">
        {job.actual_weight_kg != null ? `${job.actual_weight_kg.toFixed(0)} kg` : '—'}
      </TableCell>
      <TableCell className="text-right">
        {job.duration_minutes != null ? `${job.duration_minutes} min` : '—'}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onViewDetail(job.id)}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  )
}
