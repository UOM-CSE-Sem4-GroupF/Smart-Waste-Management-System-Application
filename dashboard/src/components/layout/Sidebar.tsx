'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Map,
  Trash2,
  Briefcase,
  BarChart3,
  Recycle,
  LogOut,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NavItem {
  icon:    React.ElementType
  label:   string
  href:    string
  roles?:  string[]  // undefined = visible to all
}

const NAV_ITEMS: NavItem[] = [
  { icon: Map,             label: 'Live Map',  href: '/dashboard/map' },
  { icon: Trash2,          label: 'Bins',      href: '/dashboard/bins' },
  { icon: Briefcase,       label: 'Jobs',      href: '/dashboard/jobs',      roles: ['supervisor', 'fleet-operator', 'admin'] },
  { icon: History,         label: 'History',   href: '/dashboard/history',   roles: ['supervisor', 'fleet-operator', 'admin'] },
  { icon: BarChart3,       label: 'Analytics', href: '/dashboard/analytics', roles: ['supervisor', 'admin'] },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()
  const role      = session?.user?.role ?? 'viewer'

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const isActive = (href: string) => pathname.startsWith(href)

  const visibleItems = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700 text-white">
          <Recycle className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">SWMS Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          General
        </p>
        {visibleItems.map(({ icon: Icon, label, href }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full',
              isActive(href)
                ? 'bg-green-50 text-green-700 font-medium dark:bg-green-950/40 dark:text-green-400'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User block */}
      <div className="mt-auto border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-semibold text-white select-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session?.user?.name ?? 'User'}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{role}</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </aside>
  )
}
