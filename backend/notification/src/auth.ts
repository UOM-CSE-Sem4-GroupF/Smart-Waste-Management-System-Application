export interface TokenData {
  sub: string;
  role: string;
  zoneId?: number;
  driverId?: string;
}

const KNOWN_ROLES = ['supervisor', 'fleet-operator', 'driver', 'viewer'] as const;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

export async function verifyToken(token: string): Promise<TokenData> {
  // Prototype: decode without Keycloak signature verification.
  // Production: verify against Keycloak JWKS endpoint.
  const payload = decodeJwtPayload(token);
  if (!payload) throw new Error('Invalid token');

  const roles: string[] = (payload.realm_access as Record<string, string[]>)?.roles ?? [];
  const role = roles.find(r => KNOWN_ROLES.includes(r as typeof KNOWN_ROLES[number])) ?? 'viewer';

  return {
    sub:      String(payload.sub ?? ''),
    role,
    zoneId:   payload.zone_id   as number | undefined,
    driverId: payload.driver_id as string | undefined,
  };
}
