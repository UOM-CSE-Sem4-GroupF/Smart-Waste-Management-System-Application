import { signOut } from '@/auth'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-sm space-y-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 mx-auto">
          <span className="text-3xl font-bold text-red-600 dark:text-red-400">!</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Access Restricted</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have permission to access the web dashboard.
            Drivers should use the SWMS mobile app instead.
          </p>
        </div>
        {/* Must sign out (clears NextAuth session + Keycloak SSO session) before
            returning to the login page, otherwise the existing session auto-signs
            the driver back in and the middleware loops them here again. */}
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  )
}
