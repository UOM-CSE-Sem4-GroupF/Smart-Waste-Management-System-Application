import ky from 'ky'
import { auth } from '@/auth'

/**
 * Server-side ky instance — calls auth() to inject the Keycloak access token.
 * Only call this in Server Components or Route Handlers (never in 'use client' files).
 */
export async function createApiClient() {
  const session = await auth()
  const token = session?.accessToken

  return ky.create({
    prefix: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 10_000,
  })
}

/**
 * Client-side ky instance — takes the access token from useSession().
 * Use this inside TanStack Query queryFn callbacks in Client Components.
 */
export function createClientApiClient(token?: string) {
  return ky.create({
    prefix: process.env.NEXT_PUBLIC_API_BASE_URL,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 10_000,
  })
}
