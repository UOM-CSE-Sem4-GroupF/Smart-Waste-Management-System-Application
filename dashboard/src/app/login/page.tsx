import { signIn } from '@/auth'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left — hero panel (desktop only) */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col bg-linear-to-br from-emerald-800 via-green-700 to-teal-600 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full bg-emerald-900/20 blur-3xl" />

        {/* Logo / brand */}
        <div className="relative z-10 flex items-center gap-3 p-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">SWMS Dashboard</span>
        </div>

        {/* Centre illustration + copy */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 text-center px-12 pb-8">
          <div className="relative w-full max-w-sm mb-10 drop-shadow-2xl">
            <Image
              src="/vector%20img.png"
              alt="Smart Waste Management illustration"
              width={460}
              height={420}
              className="mx-auto"
              priority
            />
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-white/40" />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Smart Waste Management</span>
              <span className="h-px w-10 bg-white/40" />
            </div>
            <h2 className="text-4xl font-extrabold text-white leading-tight">
              Recycle. Reduce.<br />Reimagine.
            </h2>
          </div>

          <p className="text-white/70 text-base max-w-sm leading-relaxed">
            Real-time visibility across every zone, every bin, and every collection run — all in one place.
          </p>

          {/* Stats strip */}
          <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-sm">
            {[
              { value: 'Live', label: 'Bin Status' },
              { value: 'AI', label: 'Route Optimiser' },
              { value: '24/7', label: 'Monitoring' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 py-3 px-2">
                <span className="text-2xl font-bold text-white">{value}</span>
                <span className="text-white/60 text-xs text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-10 pb-8 text-white/40 text-xs">
          F3 Group — University of Moratuwa
        </div>
      </div>

      {/* Right — sign-in form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-8 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-700">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">SWMS Dashboard</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600 text-xs font-semibold uppercase tracking-widest mb-3">
              <span className="h-0.5 w-6 bg-green-600 rounded-full inline-block" />
              Authorised Access
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your organisation account to access the dashboard.
            </p>
          </div>

          {/* Sign-in form */}
          <form
            action={async () => {
              'use server'
              await signIn(
                'keycloak',
                { redirectTo: '/dashboard' },
                { prompt: 'login' },
              )
            }}
            className="space-y-4"
          >
            <button
              type="submit"
              className="group w-full flex items-center justify-center gap-2.5 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-800 hover:shadow-lg hover:shadow-green-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              {/* Keycloak lock icon */}
              <svg className="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Sign in with Keycloak
              <svg className="w-4 h-4 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">Secured by Keycloak SSO</span>
            </div>
          </div>

          {/* Features list */}
          <ul className="space-y-2">
            {[
              'Role-based access: Supervisor, Fleet Operator, Driver',
              'Live bin telemetry and zone overview',
              'AI-powered collection scheduling',
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-xs text-muted-foreground">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {feat}
              </li>
            ))}
          </ul>

          <p className="text-center text-xs text-muted-foreground">
            Access is restricted to authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  )
}
