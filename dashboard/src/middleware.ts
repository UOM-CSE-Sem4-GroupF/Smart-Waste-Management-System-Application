import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (process.env.AUTH_DEV_BYPASS === 'true') return NextResponse.next()

  if (!req.auth && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Drivers use the Flutter app — redirect them if they land on the web dashboard
  const role = req.auth?.user?.role
  if (role === 'driver' && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }
})

export const config = {
  matcher: ['/dashboard/:path*'],
}
