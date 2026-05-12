'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { KyInstance } from 'ky'
import { Database, Search, Plus, Pencil, Trash2, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'
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
  listWasteCategories, createWasteCategory, updateWasteCategory, deleteWasteCategory,
  listCityZones, createCityZone, updateCityZone, deleteCityZone,
  listVehicles, createVehicle, updateVehicle, deleteVehicle,
  listClusters, createCluster, updateCluster, deleteCluster,
  listBins, createBinRecord, updateBinRecord, deleteBinRecord,
  listDevices, updateDevice, deleteDevice,
  listRoutePlans, updateRoutePlan,
  listZoneSnapshots,
  listModelPerformance, updateModelPerformance,
  listDrivers, updateDriverRecord,
  listCollectionJobs,
  listBinStates,
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
    id: 'waste_categories',
    label: 'Waste Categories',
    sqlName: 'f2.waste_categories',
    schema: 'f2',
    description: 'Waste type reference data — name, density, colour, flags',
    primaryKey: 'id',
    fetch: listWasteCategories,
    create: createWasteCategory,
    update: updateWasteCategory,
    remove: deleteWasteCategory,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'name', label: 'Name', type: 'text', editable: true },
      { key: 'avg_kg_per_litre', label: 'kg/L', type: 'number', editable: true },
      { key: 'colour_code', label: 'Colour', type: 'text', editable: true },
      { key: 'recyclable', label: 'Recyclable', type: 'boolean', editable: true },
      { key: 'special_handling', label: 'Special Handling', type: 'boolean', editable: true },
      { key: 'description', label: 'Description', type: 'textarea', editable: true, hideInTable: true },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'city_zones',
    label: 'City Zones',
    sqlName: 'f2.city_zones',
    schema: 'f2',
    description: 'Geographic zones — boundaries, collection schedule, supervisor',
    primaryKey: 'id',
    fetch: listCityZones,
    create: createCityZone,
    update: updateCityZone,
    remove: deleteCityZone,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'name', label: 'Name', type: 'text', editable: true },
      { key: 'code', label: 'Code', type: 'text', editable: true },
      { key: 'collection_day', label: 'Collection Day', type: 'select', editable: true, options: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
      { key: 'collection_time', label: 'Time', type: 'text', editable: true },
      { key: 'supervisor_id', label: 'Supervisor ID', type: 'text', editable: true },
      { key: 'active', label: 'Active', type: 'boolean', editable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', editable: true, hideInTable: true },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    sqlName: 'f2.vehicles',
    schema: 'f2',
    description: 'Fleet vehicles — type, capacity, driver assignment, status',
    primaryKey: 'id',
    fetch: listVehicles,
    create: createVehicle,
    update: updateVehicle,
    remove: deleteVehicle,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true, editable: true },
      { key: 'registration', label: 'Registration', type: 'text', editable: true },
      { key: 'vehicle_type', label: 'Type', type: 'select', editable: true, options: ['small','medium','large','extra_large'] },
      { key: 'max_cargo_kg', label: 'Max Cargo (kg)', type: 'number', editable: true },
      { key: 'volume_m3', label: 'Volume (m³)', type: 'number', editable: true },
      { key: 'driver_id', label: 'Driver ID', type: 'text', editable: true },
      { key: 'status', label: 'Status', type: 'select', editable: true, options: ['available','dispatched','maintenance','decommissioned'] },
      { key: 'active', label: 'Active', type: 'boolean', editable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', editable: true, hideInTable: true },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'bin_clusters',
    label: 'Bin Clusters',
    sqlName: 'f2.bin_clusters',
    schema: 'f2',
    description: 'Physical cluster locations used as VRP stop nodes',
    primaryKey: 'id',
    fetch: listClusters,
    create: createCluster,
    update: updateCluster,
    remove: deleteCluster,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true, editable: true },
      { key: 'zone_id', label: 'Zone ID', type: 'number', editable: true },
      { key: 'name', label: 'Name', type: 'text', editable: true },
      { key: 'lat', label: 'Lat', type: 'number', editable: true },
      { key: 'lng', label: 'Lng', type: 'number', editable: true },
      { key: 'address', label: 'Address', type: 'text', editable: true },
      { key: 'cluster_type', label: 'Type', type: 'select', editable: true, options: ['residential','commercial','industrial','public_space','street_corner'] },
      { key: 'active', label: 'Active', type: 'boolean', editable: true },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'bins',
    label: 'Bins',
    sqlName: 'f2.bins',
    schema: 'f2',
    description: 'Individual waste bins linked to clusters and sensor devices',
    primaryKey: 'id',
    fetch: listBins,
    create: createBinRecord,
    update: updateBinRecord,
    remove: deleteBinRecord,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true, editable: true },
      { key: 'cluster_id', label: 'Cluster ID', type: 'text', editable: true },
      { key: 'waste_category_id', label: 'Category ID', type: 'number', editable: true },
      { key: 'volume_litres', label: 'Volume (L)', type: 'number', editable: true },
      { key: 'depth_cm', label: 'Depth (cm)', type: 'number', editable: true },
      { key: 'lat', label: 'Lat', type: 'number', editable: true },
      { key: 'lng', label: 'Lng', type: 'number', editable: true },
      { key: 'address', label: 'Address', type: 'text', editable: true },
      { key: 'active', label: 'Active', type: 'boolean', editable: true },
      { key: 'notes', label: 'Notes', type: 'textarea', editable: true, hideInTable: true },
      { key: 'installed_at', label: 'Installed', type: 'datetime' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    sqlName: 'f2.devices',
    schema: 'f2',
    description: 'IoT sensors — admin-configurable firmware settings and provisioning info',
    primaryKey: 'id',
    fetch: listDevices,
    update: updateDevice,
    remove: deleteDevice,
    columns: [
      { key: 'id', label: 'Device ID', type: 'text', primaryKey: true },
      { key: 'bin_id', label: 'Bin ID', type: 'text', editable: true },
      { key: 'device_type', label: 'Type', type: 'select', editable: true, options: ['esp32_ultrasonic','esp32_weight','rpi_gateway'] },
      { key: 'status', label: 'Status', type: 'select', editable: true, options: ['provisioned','active','offline','maintenance','decommissioned'] },
      // Sensor-reported — read-only (overwritten on next heartbeat)
      { key: 'firmware_current_version', label: 'FW Running', type: 'text' },
      { key: 'battery_level_pct', label: 'Battery %', type: 'number' },
      { key: 'last_seen_at', label: 'Last Seen', type: 'datetime' },
      // Admin-configurable firmware settings
      { key: 'firmware_target_version', label: 'FW Target', type: 'text', editable: true },
      { key: 'sleep_interval_normal_s', label: 'Sleep Normal (s)', type: 'number', editable: true, hideInTable: true },
      { key: 'sleep_interval_monitor_s', label: 'Sleep Monitor (s)', type: 'number', editable: true, hideInTable: true },
      { key: 'sleep_interval_urgent_s', label: 'Sleep Urgent (s)', type: 'number', editable: true, hideInTable: true },
      { key: 'sleep_interval_critical_s', label: 'Sleep Critical (s)', type: 'number', editable: true, hideInTable: true },
      { key: 'urgency_threshold_monitor', label: 'Threshold Monitor', type: 'number', editable: true, hideInTable: true },
      { key: 'urgency_threshold_urgent', label: 'Threshold Urgent', type: 'number', editable: true, hideInTable: true },
      { key: 'urgency_threshold_critical', label: 'Threshold Critical', type: 'number', editable: true, hideInTable: true },
    ],
  },
  {
    id: 'bin_current_state',
    label: 'Bin Current State',
    sqlName: 'f2.bin_current_state',
    schema: 'f2',
    description: 'Live sensor readings written by Kafka/Flink — read-only. Editing is pointless; the next sensor message overwrites any manual change.',
    primaryKey: 'bin_id',
    fetch: listBinStates,
    // No update/create/remove — this table is owned by the sensor pipeline
    columns: [
      { key: 'bin_id', label: 'Bin ID', type: 'text', primaryKey: true },
      { key: 'fill_level_pct', label: 'Fill %', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'urgency_score', label: 'Urgency', type: 'number' },
      { key: 'battery_level_pct', label: 'Battery %', type: 'number' },
      { key: 'estimated_weight_kg', label: 'Est. Weight (kg)', type: 'number' },
      { key: 'fill_rate_pct_per_hour', label: 'Fill Rate %/h', type: 'number' },
      { key: 'predicted_full_at', label: 'Predicted Full', type: 'datetime' },
      { key: 'last_reading_at', label: 'Last Reading', type: 'datetime' },
      { key: 'last_collected_at', label: 'Last Collected', type: 'datetime' },
    ],
  },
  {
    id: 'route_plans',
    label: 'Route Plans',
    sqlName: 'f2.route_plans',
    schema: 'f2',
    description: 'OR-Tools generated route plans — waypoints, weights, status',
    primaryKey: 'id',
    fetch: listRoutePlans,
    update: updateRoutePlan,
    columns: [
      { key: 'id', label: 'ID', type: 'text', primaryKey: true },
      { key: 'vehicle_id', label: 'Vehicle', type: 'text' },
      { key: 'route_type', label: 'Type', type: 'text' },
      { key: 'zone_id', label: 'Zone', type: 'number' },
      { key: 'total_clusters', label: 'Clusters', type: 'number' },
      { key: 'total_bins', label: 'Bins', type: 'number' },
      { key: 'estimated_weight_kg', label: 'Est. Weight (kg)', type: 'number' },
      { key: 'estimated_distance_km', label: 'Distance (km)', type: 'number' },
      { key: 'estimated_minutes', label: 'Est. Minutes', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', editable: true, options: ['planned','active','completed','superseded','cancelled'] },
      { key: 'valid_for_date', label: 'Valid For', type: 'text' },
      { key: 'created_at', label: 'Created', type: 'datetime' },
    ],
  },
  {
    id: 'zone_snapshots',
    label: 'Zone Snapshots',
    sqlName: 'f2.zone_snapshots',
    schema: 'f2',
    description: 'Flink sliding-window aggregates per zone — read-only',
    primaryKey: 'id',
    fetch: listZoneSnapshots,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'zone_id', label: 'Zone', type: 'number' },
      { key: 'snapshot_at', label: 'Snapshot At', type: 'datetime' },
      { key: 'avg_fill_level_pct', label: 'Avg Fill %', type: 'number' },
      { key: 'urgent_bin_count', label: 'Urgent Bins', type: 'number' },
      { key: 'critical_bin_count', label: 'Critical Bins', type: 'number' },
      { key: 'total_bins', label: 'Total Bins', type: 'number' },
      { key: 'total_estimated_kg', label: 'Total kg', type: 'number' },
      { key: 'dominant_waste_category', label: 'Dominant Cat.', type: 'text' },
    ],
  },
  {
    id: 'model_performance',
    label: 'Model Performance',
    sqlName: 'f2.model_performance',
    schema: 'f2',
    description: 'ML model training metrics and production promotion history',
    primaryKey: 'id',
    fetch: listModelPerformance,
    update: updateModelPerformance,
    columns: [
      { key: 'id', label: 'ID', type: 'number', primaryKey: true },
      { key: 'model_name', label: 'Model', type: 'text' },
      { key: 'model_version', label: 'Version', type: 'text' },
      { key: 'trained_at', label: 'Trained At', type: 'datetime' },
      { key: 'mae_hours', label: 'MAE (h)', type: 'number' },
      { key: 'rmse_hours', label: 'RMSE (h)', type: 'number' },
      { key: 'r_squared', label: 'R²', type: 'number' },
      { key: 'promoted_to_prod', label: 'In Prod', type: 'boolean', editable: true },
      { key: 'promoted_at', label: 'Promoted At', type: 'datetime' },
    ],
  },
  {
    id: 'drivers',
    label: 'Drivers',
    sqlName: 'f3.drivers',
    schema: 'f3',
    description: 'Driver records — contact info, zone, shift times, stats',
    primaryKey: 'driver_id',
    fetch: listDrivers,
    update: updateDriverRecord,
    columns: [
      { key: 'driver_id', label: 'Driver ID', type: 'text', primaryKey: true },
      { key: 'name', label: 'Name', type: 'text', editable: true },
      { key: 'phone', label: 'Phone', type: 'text', editable: true },
      { key: 'email', label: 'Email', type: 'text', editable: true },
      { key: 'zone_id', label: 'Zone ID', type: 'number', editable: true },
      { key: 'current_vehicle_id', label: 'Vehicle', type: 'text', editable: true },
      { key: 'status', label: 'Status', type: 'select', editable: true, options: ['available','on_job','off_duty','on_break'] },
      { key: 'shift_start', label: 'Shift Start', type: 'text', editable: true },
      { key: 'shift_end', label: 'Shift End', type: 'text', editable: true },
      { key: 'total_jobs_completed', label: 'Jobs Done', type: 'number' },
      { key: 'total_bins_collected', label: 'Bins Collected', type: 'number' },
    ],
  },
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
]

const SCHEMA_GROUPS: { schema: 'f2' | 'f3'; label: string }[] = [
  { schema: 'f2', label: 'F2 — Core' },
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
      if (isCreate) {
        if (!tableDef.create) throw new Error('Create not supported for this table')
        return tableDef.create(api, payload)
      }
      if (!tableDef.update) throw new Error('Update not supported for this table')
      const id = rowId(existingRow!, tableDef.primaryKey)
      return tableDef.update(api, id, payload)
    },
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditRow(undefined)
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
        {canCreate && (
          <Button size="sm" className="h-9" onClick={() => { setEditRow(null); setDialogOpen(true) }}>
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
                            onClick={() => { setEditRow(row); setDialogOpen(true) }}
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
          onClose={() => { setDialogOpen(false); setEditRow(undefined) }}
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
