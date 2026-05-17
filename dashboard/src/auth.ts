import NextAuth from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId:     process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer:       process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt    = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      const decoded = decodeJwt(token.accessToken as string)
      const APP_ROLES = ['admin', 'supervisor', 'fleet-operator', 'driver', 'viewer']
      const realmRoles: string[] = decoded.realm_access?.roles ?? []
      const clientRoles: string[] = decoded.resource_access?.['swms-dashboard']?.roles ?? []
      const appRole = [...clientRoles, ...realmRoles].find((r) => APP_ROLES.includes(r))
      // Authenticated users with no explicit app role get full admin access
      session.user.role   = (appRole ?? 'admin') as 'admin' | 'supervisor' | 'fleet-operator' | 'driver' | 'viewer'
      session.user.zoneId = decoded.zone_id ?? null
      return session
    },
  },
})

// Simple JWT decode — no verification needed here; Kong/backend verifies signatures
function decodeJwt(token: string) {
  const base64 = token.split('.')[1]
  return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')))
}
