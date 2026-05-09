import NextAuth from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers'

// Keycloak's OIDC discovery document returns internal Kubernetes DNS URLs
// (keycloak.auth.svc.cluster.local) which the browser and server can't resolve.
// We bypass discovery entirely and hard-wire all endpoints to the external IP.
const BASE = process.env.AUTH_KEYCLOAK_ISSUER! // http://139.59.219.173/auth/realms/waste-management

interface KeycloakProfile {
  sub:              string
  name?:            string
  preferred_username?: string
  email?:           string
  picture?:         string
  realm_access?:    { roles?: string[] }
  zone_id?:         number
}

function KeycloakOAuth(): OAuthConfig<KeycloakProfile> {
  return {
    id:           'keycloak',
    name:         'Keycloak',
    type:         'oauth',
    clientId:     process.env.AUTH_KEYCLOAK_ID!,
    clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
    authorization: {
      url:    `${BASE}/protocol/openid-connect/auth`,
      params: { scope: 'openid email profile', response_type: 'code' },
    },
    token:    `${BASE}/protocol/openid-connect/token`,
    userinfo: `${BASE}/protocol/openid-connect/userinfo`,
    checks:   ['pkce', 'state'],
    profile(profile) {
      return {
        id:    profile.sub,
        name:  profile.name ?? profile.preferred_username ?? profile.sub,
        email: profile.email,
        image: profile.picture,
      }
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [KeycloakOAuth()],
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
      session.user.role   = decoded.realm_access?.roles?.[0] ?? 'viewer'
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
