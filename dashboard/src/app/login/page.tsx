import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

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
            className="space-y-4"
            action={async (formData) => {
              'use server'
              try {
                await signIn('credentials', {
                  username:   formData.get('username') as string,
                  password:   formData.get('password') as string,
                  redirectTo: '/dashboard',
                })
              } catch (err) {
                if (err instanceof AuthError) {
                  redirect('/login?error=invalid')
                }
                throw err
              }
            }}
          >
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium leading-none">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                placeholder="Enter your username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                placeholder="Enter your password"
              />
            </div>

            {error === 'invalid' && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                Invalid username or password. Please try again.
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              Sign in
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
