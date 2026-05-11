'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Plus, Pencil, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { listAccounts, disableAccount } from '@/lib/api/admin'
import { AccountFormDialog } from './AccountFormDialog'

interface Props {
  zoneOptions:    Array<{ id: number; name: string }>
  driverOptions:  Array<{ driver_id: string; name: string }>
}

const ROLES = ['', 'supervisor', 'fleet-operator', 'driver', 'viewer', 'admin']

export function AccountsTab({ zoneOptions, driverOptions }: Props) {
  const queryClient = useQueryClient()

  const [search,    setSearch]    = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [addOpen,   setAddOpen]   = useState(false)
  const [disable,   setDisable]   = useState<string | null>(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', search, roleFilter],
    queryFn: () => listAccounts({ search: search || undefined, role: roleFilter || undefined }),
  })

  const { mutate: doDisable, isPending: disabling } = useMutation({
    mutationFn: (id: string) => disableAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setDisable(null)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="flex-1 min-w-48"
          placeholder="Name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.filter(Boolean).map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> Create Account
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {['Username', 'Name', 'Role', 'Zone', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-4 bg-muted rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No accounts found.</td></tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs">{acc.username}</td>
                  <td className="px-3 py-2.5">{acc.firstName} {acc.lastName}</td>
                  <td className="px-3 py-2.5">
                    {acc.roles.filter((r) => ['supervisor', 'driver', 'fleet-operator', 'viewer', 'admin'].includes(r)).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {acc.zone_id
                      ? (zoneOptions.find((z) => String(z.id) === acc.zone_id)?.name ?? acc.zone_id)
                      : 'All'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      acc.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {acc.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {acc.createdTimestamp
                      ? formatDistanceToNow(new Date(acc.createdTimestamp), { addSuffix: true })
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {acc.enabled && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDisable(acc.id)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AccountFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        zoneOptions={zoneOptions}
        driverOptions={driverOptions}
      />

      <AlertDialog open={disable !== null} onOpenChange={(v) => { if (!v) setDisable(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable account?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={disabling}
              onClick={() => disable && doDisable(disable)}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
