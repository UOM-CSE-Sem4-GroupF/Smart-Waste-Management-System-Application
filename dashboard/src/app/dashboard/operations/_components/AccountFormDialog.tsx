'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createAccount } from '@/lib/api/admin'

const ROLES = ['supervisor', 'fleet-operator', 'driver', 'viewer'] as const

const schema = z.object({
  firstName:         z.string().min(1, 'First name is required'),
  lastName:          z.string().min(1, 'Last name is required'),
  email:             z.string().email('Invalid email'),
  role:              z.enum(ROLES),
  zone_id:           z.string().optional(),
  linked_driver_id:  z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:          boolean
  onClose:       () => void
  zoneOptions:   Array<{ id: number; name: string }>
  driverOptions: Array<{ driver_id: string; name: string }>
}

export function AccountFormDialog({ open, onClose, zoneOptions, driverOptions }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { role: 'driver' },
  })

  const role = watch('role')

  const { mutate, isPending, error } = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name*</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name*</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email*</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Role*</Label>
            <Select defaultValue="driver" onValueChange={(v) => setValue('role', v as typeof ROLES[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
          </div>

          {role === 'driver' && (
            <>
              <div className="space-y-1">
                <Label>Zone</Label>
                <Select onValueChange={(v) => setValue('zone_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((z) => (
                      <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Linked Driver</Label>
                <Select onValueChange={(v) => setValue('linked_driver_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select driver record" /></SelectTrigger>
                  <SelectContent>
                    {driverOptions.map((d) => (
                      <SelectItem key={d.driver_id} value={d.driver_id}>
                        {d.driver_id} — {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            A temporary password will be auto-generated and sent to their email.
          </p>

          {error && <p className="text-sm text-red-500">{(error as Error).message}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
