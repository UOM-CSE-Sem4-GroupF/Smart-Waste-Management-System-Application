import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const KEYCLOAK_URL    = process.env.KEYCLOAK_URL    ?? 'http://localhost:30180'
const KEYCLOAK_REALM  = process.env.KEYCLOAK_REALM  ?? 'waste-management'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireAdmin(session: any) {
  if (!session) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 })
  const roles: string[] = (session as { user?: { roles?: string[] } }).user?.roles ?? []
  if (!roles.includes('admin')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const deny = requireAdmin(session)
  if (deny) return deny

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const role   = req.nextUrl.searchParams.get('role') ?? ''
  const max    = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)

  try {
    const adminToken = await getAdminToken()
    const url = new URL(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`)
    if (search) url.searchParams.set('search', search)
    url.searchParams.set('max', String(max))

    const usersRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (!usersRes.ok) throw new Error(`Keycloak users list failed: ${usersRes.statusText}`)
    let users = await usersRes.json() as Array<Record<string, unknown>>

    // Fetch roles for each user (simplified — only realm roles)
    const withRoles = await Promise.all(
      users.map(async (user) => {
        const rolesRes = await fetch(
          `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user.id}/role-mappings/realm`,
          { headers: { Authorization: `Bearer ${adminToken}` } },
        )
        const roles: Array<{ name: string }> = rolesRes.ok ? await rolesRes.json() : []
        return { ...user, roles: roles.map((r) => r.name) }
      }),
    )

    // Filter by role if requested
    const filtered = role
      ? withRoles.filter((u) => Array.isArray(u.roles) && (u.roles as string[]).includes(role))
      : withRoles

    return NextResponse.json(filtered)
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const deny = requireAdmin(session)
  if (deny) return deny

  try {
    const body = await req.json() as {
      firstName: string
      lastName: string
      email: string
      role: string
      zone_id?: string
      linked_driver_id?: string
    }

    const adminToken = await getAdminToken()

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-4)

    // Create user
    const createRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName:   body.firstName,
          lastName:    body.lastName,
          email:       body.email,
          username:    body.email,
          enabled:     true,
          emailVerified: false,
          credentials: [{ type: 'password', value: tempPassword, temporary: true }],
          attributes: {
            ...(body.zone_id           ? { zone_id:           [body.zone_id] }           : {}),
            ...(body.linked_driver_id  ? { linked_driver_id:  [body.linked_driver_id] }  : {}),
          },
        }),
      },
    )

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({ errorMessage: createRes.statusText })) as { errorMessage?: string }
      return NextResponse.json({ message: err.errorMessage ?? 'Failed to create user' }, { status: createRes.status })
    }

    // Get the new user's ID from the Location header
    const location  = createRes.headers.get('Location') ?? ''
    const userId    = location.split('/').pop() ?? ''

    // Assign realm role
    const rolesRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles/${body.role}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    if (rolesRes.ok) {
      const roleObj = await rolesRes.json() as { id: string; name: string }
      await fetch(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([roleObj]),
        },
      )
    }

    return NextResponse.json({ id: userId, email: body.email, roles: [body.role] }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ message: (e as Error).message }, { status: 500 })
  }
}
