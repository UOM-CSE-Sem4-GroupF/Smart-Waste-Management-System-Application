'use client'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { ConnectionBadge } from './ConnectionBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Live Map',
  '/dashboard/map':       'Live Map',
  '/dashboard/bins':      'Bins',
  '/dashboard/jobs':      'Collection Jobs',
  '/dashboard/history':   'History',
  '/dashboard/analytics': 'Analytics',
}

function getTitle(pathname: string): string {
  // exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // dynamic segments: /dashboard/bins/[id], /dashboard/jobs/[id]
  if (pathname.startsWith('/dashboard/bins/'))    return 'Bin Detail'
  if (pathname.startsWith('/dashboard/jobs/'))    return 'Job Detail'
  if (pathname.startsWith('/dashboard/history/')) return 'History'
  return 'Dashboard'
}

export function Topbar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-sm">
      <h1 className="text-lg font-semibold">{getTitle(pathname)}</h1>
      <div className="ml-auto flex items-center gap-2">
        <ConnectionBadge />
        <ThemeToggle />
        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-semibold text-white select-none hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{session?.user?.name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{session?.user?.role ?? 'viewer'}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
