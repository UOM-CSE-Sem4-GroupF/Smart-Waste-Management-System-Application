import { NextRequest, NextResponse } from 'next/server'

const KEYCLOAK_URL    = process.env.KEYCLOAK_URL   ?? 'http://localhost:30180'
const KEYCLOAK_REALM  = process.env.KEYCLOAK_REALM ?? 'waste-management'
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli'
const ADMIN_SECRET    = process.env.KEYCLOAK_ADMIN_SECRET

async function getAdminToken(): Promise<string> {
  const res = await fetch(
    `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     ADMIN_CLIENT_ID,
        client_secret: ADMIN_SECRET ?? '',
      }),
    },
  )
  if (!res.ok) throw new Error(`Keycloak admin token failed: ${res.statusText}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const body = await req.json() as Record<string, unknown>
    const adminToken = await getAdminToken()

    const updateRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!updateRes.ok) {
      return NextResponse.json({ message: `Update failed: ${updateRes.statusText}` }, { status: updateRes.status })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 500 })
  }
}
