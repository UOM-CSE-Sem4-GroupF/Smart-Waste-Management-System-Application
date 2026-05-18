import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const DATA_ANALYSIS_BASE =
  `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '')}/data-analysis`

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function forward(req: NextRequest, { params }: RouteContext) {
  const { path } = await params
  const session = await auth()
  const target = new URL(`${DATA_ANALYSIS_BASE}/${path.join('/')}`)

  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value)
  })

  const headers = new Headers()
  headers.set('accept', 'application/json')
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  const incomingAuth = req.headers.get('authorization')
  const token = session?.accessToken
  if (incomingAuth) {
    headers.set('authorization', incomingAuth)
  } else if (token) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const upstream = await fetch(target, {
    method:  req.method,
    headers,
    body:    hasBody ? await req.text() : undefined,
    cache:   'no-store',
  })

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const body = await upstream.text()
  return new NextResponse(body, {
    status:  upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  })
}

export const GET    = forward
export const POST   = forward
export const PATCH  = forward
export const DELETE = forward
