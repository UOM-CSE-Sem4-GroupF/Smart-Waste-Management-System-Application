import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    user: {
      name?:   string | null
      email?:  string | null
      role:    'supervisor' | 'fleet-operator' | 'driver' | 'viewer' | 'admin'
      zoneId:  number | null
    }
  }
}
