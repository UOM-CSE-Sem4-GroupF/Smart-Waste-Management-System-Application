'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Map,
  Trash2,
  Briefcase,
  BarChart3,
  Recycle,
  LogOut,
  ChevronRight,
  Settings2,
  DatabaseZap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NavItem {
  icon:    React.ElementType
  label:   string
  href:    string
  roles?:  string[]  // undefined = visible to all
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Overview',  href: '/dashboard' },
  { icon: Map,             label: 'Live Map',  href: '/dashboard/map' },
  { icon: Trash2,          label: 'Bins',      href: '/dashboard/bins' },
  { icon: Briefcase,       label: 'Jobs',      href: '/dashboard/jobs',      roles: ['supervisor', 'fleet-operator', 'admin'] },
  { icon: Settings2,       label: 'Operations', href: '/dashboard/operations', roles: ['supervisor', 'admin'] },
  { icon: BarChart3,       label: 'Analytics', href: '/dashboard/analytics', roles: ['supervisor', 'admin'] },
  { icon: DatabaseZap,     label: 'System Mgmt', href: '/dashboard/system-management', roles: ['admin'] },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()
  // BYPASS: Default to admin role if no session is present (dev/demo mode)
  const role      = session?.user?.role ?? 'admin'

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AS'

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const visibleItems = NAV_ITEMS.filter((item) =>
    !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="relative flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-950/80">
      {/* Branding */}
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6 dark:border-slate-900">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Recycle className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
            Dashboard
          </span>
          <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400">
            SWMS Live
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
        <p className="mb-4 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Main Console
        </p>
        {visibleItems.map(({ icon: Icon, label, href }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200',
                active
                  ? 'bg-emerald-50/80 text-emerald-700 shadow-sm ring-1 ring-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-100',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
                )} />
                <span className="font-semibold tracking-tight">{label}</span>
              </div>
              {active && (
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              )}
              {!active && (
                <ChevronRight className="h-3 w-3 translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-40" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Session Block */}
      <div className="mt-auto border-t border-slate-100 p-4 dark:border-slate-900">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/40">
          <div className="relative">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-slate-200 to-slate-300 text-xs font-black text-slate-600 shadow-inner select-none dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              {session?.user?.name ?? 'Alex Supervisor'}
            </p>
            <p className="truncate text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              {session?.user?.role ?? 'supervisor'}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Logout Session</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

    </aside>
  )
}

