import NextAuth from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = credentials as { username: string; password: string }
        if (!username || !password) return null

        const res = await fetch(
          `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type:    'password',
              client_id:     process.env.AUTH_KEYCLOAK_ID!,
              client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
              username,
              password,
              scope:         'openid profile email roles',
            }),
          },
        )

        if (!res.ok) return null

        const tokens = await res.json()
        return {
          id:           username,
          name:         username,
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt:    Math.floor(Date.now() / 1000) + tokens.expires_in,
        }
      },
    }),
    Keycloak({
      clientId:     process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer:       process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'credentials' && user) {
        token.accessToken  = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.expiresAt    = (user as any).expiresAt
      } else if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt    = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      if (!token?.accessToken) return session

      try {
        session.accessToken = token.accessToken as string
        const decoded = decodeJwt(token.accessToken as string)
        session.user.role   = decoded?.realm_access?.roles?.[0] ?? 'viewer'
        session.user.zoneId = decoded?.zone_id ?? null
      } catch (err) {
        console.error('[Auth] Decode error:', err)
      }
      return session
    },
  },
})

function decodeJwt(token: string) {
  const base64 = token.split('.')[1]
  return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')))
}
