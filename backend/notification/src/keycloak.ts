const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');

let cachedToken: { token: string; expiresAt: number } | null = null;

function envVar(name: string): string | undefined {
  return process.env[name];
}

async function fetchAdminToken(): Promise<string | null> {
  const base = envVar('KEYCLOAK_BASE_URL');
  const realm = envVar('KEYCLOAK_REALM');
  const clientId = envVar('KEYCLOAK_CLIENT_ID');
  const clientSecret = envVar('KEYCLOAK_CLIENT_SECRET');

  if (!base || !realm || !clientId || !clientSecret) {
    slog('WARN', 'Keycloak admin credentials not configured (KEYCLOAK_BASE_URL/REALM/CLIENT_ID/CLIENT_SECRET)');
    return null;
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const url = `${base.replace(/\/+$/, '')}/realms/${realm}/protocol/openid-connect/token`;

  try {
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);

    const res = await (globalThis as any).fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      slog('WARN', `Keycloak token request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const token = data.access_token as string | undefined;
    const expiresIn = Number(data.expires_in) || 300;
    if (!token) return null;

    cachedToken = { token, expiresAt: Date.now() + (expiresIn - 30) * 1000 };
    return token;
  } catch (err) {
    slog('WARN', `Keycloak token fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Read a user attribute from Keycloak admin API. Returns first string value or null.
 */
export async function getUserAttribute(userId: string, attrName: string): Promise<string | null> {
  const base = envVar('KEYCLOAK_BASE_URL');
  const realm = envVar('KEYCLOAK_REALM');

  if (!base || !realm) {
    slog('WARN', 'Keycloak base/realm not configured — cannot fetch user attributes');
    return null;
  }

  const token = await fetchAdminToken();
  if (!token) return null;

  const url = `${base.replace(/\/+$/, '')}/admin/realms/${realm}/users/${encodeURIComponent(userId)}`;

  try {
    const res = await (globalThis as any).fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      slog('WARN', `Keycloak user fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const user = await res.json();
    const attrs = user.attributes ?? {};
    const val = attrs[attrName];
    if (!val) return null;
    if (Array.isArray(val)) return String(val[0]);
    return String(val);
  } catch (err) {
    slog('WARN', `Keycloak user attribute fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
