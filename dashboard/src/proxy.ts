import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/api/auth/signin', req.url))
  }

  // Drivers use the Flutter app — redirect them if they land on the web dashboard
  const role = req.auth?.user?.role
  if (role === 'driver' && req.nextUrl.pathname.startsWith('/dashboard')) {
    const url = req.nextUrl.clone()
    url.pathname = '/unauthorized'
    return Response.redirect(url)
  }
})

export const config = {
  matcher: ['/dashboard/:path*'],
}
