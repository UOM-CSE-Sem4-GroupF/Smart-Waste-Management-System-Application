import { NextRequest, NextResponse } from 'next/server'

const ORCHESTRATOR = process.env.ORCHESTRATOR_URL ?? 'http://139.59.219.173'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${ORCHESTRATOR}/api/v1/collection-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
