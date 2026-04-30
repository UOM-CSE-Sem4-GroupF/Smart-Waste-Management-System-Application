'use client'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ThemeToggle } from './ThemeToggle'
import { AlertBell } from './AlertBell'
import { ConnectionBadge } from './ConnectionBadge'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':           'Overview',
  '/dashboard/map':       'Live Map',
  '/dashboard/bins':      'Bins',
  '/dashboard/jobs':      'Collection Jobs',
  '/dashboard/fleet':     'Fleet',
  '/dashboard/analytics': 'Analytics',
}

function getTitle(pathname: string): string {
  // exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // dynamic segments: /dashboard/bins/[id], /dashboard/jobs/[id]
  if (pathname.startsWith('/dashboard/bins/'))  return 'Bin Detail'
  if (pathname.startsWith('/dashboard/jobs/'))  return 'Job Detail'
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
        <AlertBell />
        <ThemeToggle />
        {/* User avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-semibold text-white select-none">
          {initials}
        </div>
      </div>
    </header>
  )
}
