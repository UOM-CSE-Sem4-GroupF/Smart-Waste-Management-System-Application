import { verify } from 'jsonwebtoken';

export interface DecodedToken {
  sub: string;
  realm_access?: { roles: string[] };
  zone_id?: string;
  driver_id?: string;
  email?: string;
  preferred_username?: string;
}

/**
 * Verify a JWT token from Keycloak.
 * If KEYCLOAK_PUBLIC_KEY is not set, tokens are not verified (dev mode).
 */
export function verifyKeycloakToken(token: string): DecodedToken {
  const publicKey = process.env.KEYCLOAK_PUBLIC_KEY;

  if (!publicKey) {
    // Dev mode: skip verification, just decode
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  }

  try {
    return verify(token, publicKey, { algorithms: ['RS256'] }) as DecodedToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract JWT from handshake (token in auth or Authorization header).
 */
export function extractToken(handshake: any): string | null {
  return handshake.auth?.token || handshake.headers?.authorization?.replace('Bearer ', '');
}

/**
 * Get user role from decoded token. Returns the first role or 'viewer' default.
 */
export function getRole(decoded: DecodedToken): string {
  return decoded.realm_access?.roles?.[0] ?? 'viewer';
}
