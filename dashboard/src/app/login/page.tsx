import { signIn } from '@/auth'

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — brand panel (desktop only) */}
      <div className="hidden lg:flex flex-col justify-between bg-green-800 p-12 text-white dark:bg-green-950">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
            <span className="text-lg font-bold">S</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">SWMS Dashboard</span>
        </div>
        <blockquote className="space-y-3">
          <p className="text-2xl font-medium leading-relaxed">
            Real-time visibility across every zone, every bin, every collection run.
          </p>
          <footer className="text-sm text-white/60">F3 Group — University of Moratuwa</footer>
        </blockquote>
      </div>

      {/* Right — sign-in form */}
      <div className="flex items-center justify-center bg-background p-8">
        <div className="mx-auto w-full max-w-sm space-y-6">
          {/* Mobile-only logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-green-700" />
            <span className="text-lg font-semibold">SWMS Dashboard</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your organisation account to continue
            </p>
          </div>

          <form
            action={async () => {
              'use server'
              await signIn('keycloak', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              Sign in with Keycloak
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Access is restricted to authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  )
}
