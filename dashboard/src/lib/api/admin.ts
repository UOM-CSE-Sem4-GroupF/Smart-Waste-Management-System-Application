import type { KyInstance } from 'ky'

export interface KeycloakAccount {
  id:          string
  username:    string
  email:       string
  firstName:   string
  lastName:    string
  enabled:     boolean
  roles:       string[]
  zone_id?:    string
  linked_driver_id?: string
  createdTimestamp?: number
}

export interface CreateAccountPayload {
  firstName:          string
  lastName:           string
  email:              string
  role:               'supervisor' | 'fleet-operator' | 'driver' | 'viewer'
  zone_id?:           string
  linked_driver_id?:  string
}

export type UpdateAccountPayload = Partial<Omit<CreateAccountPayload, 'email'> & { enabled: boolean }>

export async function listAccounts(params?: { search?: string; role?: string; limit?: number }): Promise<KeycloakAccount[]> {
  const url = new URL('/api/admin/accounts', window.location.origin)
  if (params?.search) url.searchParams.set('search', params.search)
  if (params?.role) url.searchParams.set('role', params.role)
  if (params?.limit) url.searchParams.set('limit', String(params.limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to list accounts: ${res.statusText}`)
  return res.json()
}

export async function createAccount(payload: CreateAccountPayload): Promise<KeycloakAccount> {
  const res = await fetch('/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'Failed to create account')
  }
  return res.json()
}

export async function updateAccount(id: string, payload: UpdateAccountPayload): Promise<void> {
  const res = await fetch(`/api/admin/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update account: ${res.statusText}`)
}

export async function disableAccount(id: string): Promise<void> {
  await updateAccount(id, { enabled: false })
}

// This function is only used in server actions / route handlers.
// It uses the Keycloak Admin REST API directly.
export async function _adminGetUsers(
  accessToken: string,
  keycloakUrl: string,
  realm: string,
  params?: { search?: string; max?: number },
): Promise<KeycloakAccount[]> {
  const url = new URL(`${keycloakUrl}/admin/realms/${realm}/users`)
  if (params?.search) url.searchParams.set('search', params.search)
  url.searchParams.set('max', String(params?.max ?? 100))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Keycloak admin users failed: ${res.statusText}`)
  return res.json()
}
