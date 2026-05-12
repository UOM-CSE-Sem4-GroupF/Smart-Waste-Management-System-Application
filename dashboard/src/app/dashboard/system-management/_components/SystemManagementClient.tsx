'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { KyInstance } from 'ky'
import { HTTPError } from 'ky'
import { Database, Search, Plus, Pencil, Trash2, RefreshCw, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createClientApiClient } from '@/lib/api-client'
import {
  type Row,
  listCollectionJobs,
  listRoutineSchedules, listEmergencyJobDetails, listRoutineJobDetails,
  listJobExecutionMetrics, listBinCollectionRecords, listJobStateTransitions,
  listJobStepResults, listDriverAssignmentHistory, listVehicleWeightLogs,
} from '@/lib/api/sysadmin'

// ── Column / Table type definitions ──────────────────────────────────────────

type FieldType = 'text' | 'number' | 'boolean' | 'datetime' | 'json' | 'select' | 'textarea'

interface ColumnDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  editable?: boolean
  hideInTable?: boolean
  primaryKey?: boolean
}

interface TableDef {
  id: string
  label: string
  sqlName: string
  schema: 'f2' | 'f3'
  description: string
  primaryKey: string
  columns: ColumnDef[]
  fetch: (api: KyInstance, params?: Record<string, string | number>) => Promise<{ data: Row[]; total: number; page: number; pages: number }>
  update?: (api: KyInstance, id: string, payload: Row) => Promise<unknown>
  create?: (api: KyInstance, payload: Row) => Promise<unknown>
  remove?: (api: KyInstance, id: string) => Promise<unknown>
}

// ── Table definitions ─────────────────────────────────────────────────────────

const TABLES: TableDef[] = [
  {
    id: 'collection_jobs',
    label: 'Collection Jobs',
    sqlName: 'f3.collection_jobs',
    schema: 'f3',
    description: 'Job lifecycle records — state machine, assignment, priority',
    primaryKey: 'id',
    fetch: listCollectionJobs,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'job_type', label: 'Type', type: 'text' },
      { key: 'zone_id', label: 'Zone', type: 'number' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'assigned_vehicle_id', label: 'Vehicle', type: 'text' },
      { key: 'assigned_driver_id', label: 'Driver', type: 'text' },
      { key: 'planned_weight_kg', label: 'Planned kg', type: 'number' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
  },
  {
    id: 'routine_schedules',
    label: 'Routine Schedules',
    sqlName: 'f3.routine_schedules',
    schema: 'f3',
    description: 'Defines recurring collection schedule per zone',
    primaryKey: 'id',
    fetch: listRoutineSchedules,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'zone_id', label: 'Zone ID', type: 'number' },
      { key: 'waste_category_id', label: 'Category ID', type: 'number' },
      { key: 'frequency', label: 'Frequency', type: 'text' },
      { key: 'day_of_week', label: 'Day of Week', type: 'text' },
      { key: 'time_of_day', label: 'Time of Day', type: 'text' },
      { key: 'active', label: 'Active', type: 'boolean' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'emergency_job_details',
    label: 'Emergency Job Details',
    sqlName: 'f3.emergency_job_details',
    schema: 'f3',
    description: 'Facts specific to emergency jobs (trigger cluster, wait window)',
    primaryKey: 'job_id',
    fetch: listEmergencyJobDetails,
    columns: [
      { key: 'job_id', label: 'Job ID', type: 'text', primaryKey: true },
      { key: 'trigger_bin_id', label: 'Trigger Bin', type: 'text' },
      { key: 'trigger_cluster_id', label: 'Trigger Cluster', type: 'text' },
      { key: 'trigger_urgency_score', label: 'Urgency Score', type: 'number' },
      { key: 'wait_window_applied', label: 'Wait Applied', type: 'boolean' },
      { key: 'additional_clusters_found', label: 'Extra Clusters', type: 'number' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'routine_job_details',
    label: 'Routine Job Details',
    sqlName: 'f3.routine_job_details',
    schema: 'f3',
    description: 'Facts specific to routine jobs (schedule ID, zone coverage)',
    primaryKey: 'job_id',
    fetch: listRoutineJobDetails,
    columns: [
      { key: 'job_id', label: 'Job ID', type: 'text', primaryKey: true },
      { key: 'schedule_id', label: 'Schedule ID', type: 'text' },
      { key: 'scheduled_date', label: 'Date', type: 'text' },
      { key: 'scheduled_time', label: 'Time', type: 'text' },
      { key: 'zone_coverage', label: 'Coverage', type: 'text' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'job_execution_metrics',
    label: 'Job Execution Metrics',
    sqlName: 'f3.job_execution_metrics',
    schema: 'f3',
    description: 'Facts about how the job was executed (efficiency, duration)',
    primaryKey: 'job_id',
    fetch: listJobExecutionMetrics,
    columns: [
      { key: 'job_id', label: 'Job ID', type: 'text', primaryKey: true },
      { key: 'actual_weight_kg', label: 'Actual Weight', type: 'number' },
      { key: 'actual_distance_km', label: 'Actual Dist', type: 'number' },
      { key: 'actual_duration_min', label: 'Actual Duration', type: 'number' },
      { key: 'vehicle_utilisation_pct', label: 'Utilisation %', type: 'number' },
      { key: 'distance_efficiency_pct', label: 'Dist Efficiency %', type: 'number' },
      { key: 'duration_efficiency_pct', label: 'Time Efficiency %', type: 'number' },
      { key: 'recorded_at', label: 'Recorded At', type: 'datetime' },
    ],
  },
  {
    id: 'bin_collection_records',
    label: 'Bin Collection Records',
    sqlName: 'f3.bin_collection_records',
    schema: 'f3',
    description: 'One row per bin per job recording pickups and skips',
    primaryKey: 'id',
    fetch: listBinCollectionRecords,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'job_id', label: 'Job ID', type: 'text' },
      { key: 'bin_id', label: 'Bin ID', type: 'text' },
      { key: 'sequence_number', label: 'Sequence', type: 'number' },
      { key: 'collected_at', label: 'Collected At', type: 'datetime' },
      { key: 'skipped_at', label: 'Skipped At', type: 'datetime' },
      { key: 'skip_reason', label: 'Skip Reason', type: 'text' },
      { key: 'actual_weight_kg', label: 'Actual kg', type: 'number' },
    ],
  },
  {
    id: 'job_state_transitions',
    label: 'Job State Transitions',
    sqlName: 'f3.job_state_transitions',
    schema: 'f3',
    description: 'Immutable audit log of all state changes',
    primaryKey: 'id',
    fetch: listJobStateTransitions,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'job_id', label: 'Job ID', type: 'text' },
      { key: 'from_state', label: 'From', type: 'text' },
      { key: 'to_state', label: 'To', type: 'text' },
      { key: 'actor', label: 'Actor', type: 'text' },
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'transitioned_at', label: 'Transitioned', type: 'datetime' },
    ],
  },
  {
    id: 'job_step_results',
    label: 'Job Step Results',
    sqlName: 'f3.job_step_results',
    schema: 'f3',
    description: 'Log of every external service call made by orchestrator',
    primaryKey: 'id',
    fetch: listJobStepResults,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'job_id', label: 'Job ID', type: 'text' },
      { key: 'step_name', label: 'Step', type: 'text' },
      { key: 'attempt_number', label: 'Attempt', type: 'number' },
      { key: 'success', label: 'Success', type: 'boolean' },
      { key: 'service_called', label: 'Service', type: 'text' },
      { key: 'duration_ms', label: 'Duration (ms)', type: 'number' },
      { key: 'executed_at', label: 'Executed At', type: 'datetime' },
    ],
  },
  {
    id: 'driver_assignment_history',
    label: 'Driver Assignment History',
    sqlName: 'f3.driver_assignment_history',
    schema: 'f3',
    description: 'Tracks every assignment attempt per job',
    primaryKey: 'id',
    fetch: listDriverAssignmentHistory,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'job_id', label: 'Job ID', type: 'text' },
      { key: 'driver_id', label: 'Driver ID', type: 'text' },
      { key: 'assignment_type', label: 'Type', type: 'text' },
      { key: 'rejection_reason', label: 'Reason', type: 'text' },
      { key: 'offered_at', label: 'Offered At', type: 'datetime' },
      { key: 'responded_at', label: 'Responded At', type: 'datetime' },
    ],
  },
  {
    id: 'vehicle_weight_logs',
    label: 'Vehicle Weight Logs',
    sqlName: 'f3.vehicle_weight_logs',
    schema: 'f3',
    description: 'Actual cargo weight per job',
    primaryKey: 'id',
    fetch: listVehicleWeightLogs,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'job_id', label: 'Job ID', type: 'text' },
      { key: 'vehicle_id', label: 'Vehicle', type: 'text' },
      { key: 'weight_before_kg', label: 'Tare kg', type: 'number' },
      { key: 'weight_after_kg', label: 'Gross kg', type: 'number' },
      { key: 'net_cargo_kg', label: 'Net kg', type: 'number' },
      { key: 'utilisation_pct', label: 'Utilisation %', type: 'number' },
      { key: 'recorded_at', label: 'Recorded At', type: 'datetime' },
    ],
  },
]

const SCHEMA_GROUPS: { schema: 'f2' | 'f3'; label: string }[] = [
  { schema: 'f3', label: 'F3 — Operations' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCell(value: unknown, type: FieldType): string {
  if (value === null || value === undefined) return '—'
  if (type === 'boolean') return value ? 'Yes' : 'No'
  if (type === 'datetime') {
    try { return formatDistanceToNow(new Date(String(value)), { addSuffix: true }) }
    catch { return String(value) }
  }
  if (type === 'json') return typeof value === 'object' ? JSON.stringify(value).slice(0, 60) + '…' : String(value)
  return String(value)
}

function rowId(row: Row, primaryKey: string): string {
  return String(row[primaryKey] ?? '')
}

// ── Row Edit Dialog ───────────────────────────────────────────────────────────

interface RowEditDialogProps {
  open: boolean
  onClose: () => void
  tableDef: TableDef
  row: Row | null
  onSave: (payload: Row) => void
  isPending: boolean
  error: Error | null
}

function RowEditDialog({ open, onClose, tableDef, row, onSave, isPending, error }: RowEditDialogProps) {
  const isCreate = row === null
  const editableCols = tableDef.columns.filter((c) => c.editable)

  const [form, setForm] = useState<Row>(() => {
    const initial: Row = {}
    for (const col of editableCols) {
      initial[col.key] = isCreate ? '' : (row?.[col.key] ?? '')
    }
    return initial
  })

  const handleChange = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = () => {
    const payload: Row = {}
    for (const col of editableCols) {
      // Primary key goes in the URL path for updates — never in the body
      if (!isCreate && col.primaryKey) continue

      const v = form[col.key]
      if (col.type === 'number') {
        payload[col.key] = v === '' || v === undefined ? undefined : Number(v)
      } else if (col.type === 'boolean') {
        payload[col.key] = v === 'true' || v === true
      } else {
        payload[col.key] = v === '' ? undefined : v
      }
    }
    onSave(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add Row' : 'Edit Row'} — {tableDef.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {editableCols.map((col) => (
            <div key={col.key} className="space-y-1.5">
              <Label htmlFor={col.key} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </Label>

              {col.type === 'boolean' ? (
                <Select
                  value={String(form[col.key] ?? 'false')}
                  onValueChange={(v) => handleChange(col.key, v)}
                >
                  <SelectTrigger id={col.key}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : col.type === 'select' && col.options ? (
                <Select
                  value={String(form[col.key] ?? '')}
                  onValueChange={(v) => handleChange(col.key, v)}
                >
                  <SelectTrigger id={col.key}><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {col.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : col.type === 'textarea' ? (
                <textarea
                  id={col.key}
                  className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                />
              ) : (
                <Input
                  id={col.key}
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>Save failed:</strong> {error.message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : isCreate ? 'Add Row' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Table Browser ─────────────────────────────────────────────────────────────

interface TableBrowserProps {
  tableDef: TableDef
  api: KyInstance
}

function TableBrowser({ tableDef, api }: TableBrowserProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // undefined = dialog closed, null = creating new, Row = editing existing
  const [editRow, setEditRow] = useState<Row | null | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const queryKey = ['sysadmin', tableDef.id, page]

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => tableDef.fetch(api, { page, limit: 50 }),
    staleTime: 30_000,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sysadmin', tableDef.id] })
  }, [queryClient, tableDef.id])

  const saveMutation = useMutation({
    mutationFn: async ({ payload, isCreate, existingRow }: { payload: Row; isCreate: boolean; existingRow: Row | null }) => {
      try {
        if (isCreate) {
          if (!tableDef.create) throw new Error('Create not supported for this table')
          return await tableDef.create(api, payload)
        }
        if (!tableDef.update) throw new Error('Update not supported for this table')
        const id = rowId(existingRow!, tableDef.primaryKey)
        return await tableDef.update(api, id, payload)
      } catch (e) {
        if (e instanceof HTTPError) {
          const body = await e.response.text().catch(() => '')
          const detail = body ? `: ${body}` : ''
          throw new Error(`HTTP ${e.response.status}${detail}`)
        }
        throw e
      }
    },
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditRow(undefined)
      setSavedAt(Date.now())
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row: Row) => {
      if (!tableDef.remove) throw new Error('Delete not supported')
      return tableDef.remove(api, rowId(row, tableDef.primaryKey))
    },
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const visibleCols = tableDef.columns.filter((c) => !c.hideInTable)

  const filteredRows = useMemo(() => {
    const rows = data?.data ?? []
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(term))
    )
  }, [data?.data, search])

  const canEdit   = Boolean(tableDef.update)
  const canCreate = Boolean(tableDef.create)
  const canDelete = Boolean(tableDef.remove)

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            placeholder="Search rows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="ghost" size="icon" className="h-9 w-9"
          onClick={() => refetch()} disabled={isFetching} title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
        {savedAt && Date.now() - savedAt < 4000 && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {canCreate && (
          <Button size="sm" className="h-9" onClick={() => { saveMutation.reset(); setEditRow(null); setDialogOpen(true) }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Row
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <span>Failed to load data — backend may be offline.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No rows found.</div>
        ) : (
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <tr>
                {visibleCols.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                {(canEdit || canDelete) && (
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={String(row[tableDef.primaryKey] ?? idx)} className="border-b last:border-0 hover:bg-muted/30">
                  {visibleCols.map((col) => {
                    const val = row[col.key]
                    return (
                      <td key={col.key} className="max-w-48 truncate px-3 py-2.5 font-mono text-xs">
                        {col.type === 'boolean' ? (
                          <Badge variant={val ? 'default' : 'outline'} className="text-[10px]">
                            {val ? 'Yes' : 'No'}
                          </Badge>
                        ) : (
                          <span
                            className={cn('block max-w-[180px] truncate', col.primaryKey && 'font-semibold text-foreground')}
                            title={String(val ?? '')}
                          >
                            {formatCell(val, col.type)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {(canEdit || canDelete) && (
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {canEdit && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { saveMutation.reset(); setSavedAt(null); setEditRow(row); setDialogOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{data.total} total rows</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span>Page {page} of {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Edit / Create dialog */}
      {dialogOpen && editRow !== undefined && (
        <RowEditDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditRow(undefined); saveMutation.reset() }}
          tableDef={tableDef}
          row={editRow}
          onSave={(p) => saveMutation.mutate({ payload: p, isCreate: editRow === null, existingRow: editRow })}
          isPending={saveMutation.isPending}
          error={saveMutation.error ?? null}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog open onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete row?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Permanently remove the record with {tableDef.primaryKey} = <strong>{String(deleteTarget[tableDef.primaryKey])}</strong>.
            </p>
            {deleteMutation.error && (
              <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────────

export function SystemManagementClient() {
  const { data: session } = useSession()
  const api = useMemo(
    () => createClientApiClient(session?.accessToken),
    [session?.accessToken],
  )

  const [selectedTableId, setSelectedTableId] = useState<string>(TABLES[0].id)
  const selectedTable = TABLES.find((t) => t.id === selectedTableId) ?? TABLES[0]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">System Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw database inspector — view and edit records across all schema tables.
        </p>
      </div>

      <div className="flex h-[calc(100vh-13rem)] gap-4 overflow-hidden">
        {/* Left: Table tree */}
        <aside className="w-56 shrink-0 overflow-y-auto rounded-xl border bg-card">
          {SCHEMA_GROUPS.map(({ schema, label }) => {
            const tables = TABLES.filter((t) => t.schema === schema)
            return (
              <div key={schema}>
                <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-muted/80 px-3 py-2 backdrop-blur-sm">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                </div>
                <div className="px-2 pb-2">
                  {tables.map((table) => {
                    const active = table.id === selectedTableId
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setSelectedTableId(table.id)}
                        className={cn(
                          'group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                          active
                            ? 'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'text-slate-600 hover:bg-muted hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                        )}
                      >
                        <span className="truncate font-mono font-medium">{table.label}</span>
                        {active ? (
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </aside>

        {/* Right: Table browser */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          {/* Table header */}
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selectedTable.label}</span>
              <Badge variant="outline" className="font-mono text-[10px]">{selectedTable.sqlName}</Badge>
              {(selectedTable.update || selectedTable.create) ? (
                <Badge variant="secondary" className="text-[10px]">editable</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">read-only</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{selectedTable.description}</p>
          </div>

          <TableBrowser key={selectedTable.id} tableDef={selectedTable} api={api} />
        </div>
      </div>
    </div>
  )
}
