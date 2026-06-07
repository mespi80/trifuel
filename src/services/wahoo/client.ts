/**
 * Wahoo API client.
 *
 * Authenticated requests go through `wahooRequest`, which auto-refreshes
 * an expired access token before the call.
 */

import {
  getOAuth2Tokens,
  storeOAuth2Tokens,
  revokeOAuth2Connection,
  isTokenExpired,
  refreshAccessToken,
} from '@/services/wearables/oauth2'

export const WAHOO_API_BASE = 'https://api.wahooligan.com'
export const WAHOO_TOKEN_URL = `${WAHOO_API_BASE}/oauth/token`

// ── Credentials ────────────────────────────────────────────────────────────────

function creds() {
  const clientId = process.env.WAHOO_CLIENT_ID
  const clientSecret = process.env.WAHOO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('WAHOO_CLIENT_ID and WAHOO_CLIENT_SECRET must be set')
  }
  return { clientId, clientSecret }
}

// ── Token management ───────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the user, refreshing if necessary.
 * Throws if the user has no active Wahoo connection.
 */
async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getOAuth2Tokens(userId, 'wahoo')
  if (!tokens) {
    throw new Error(`No active Wahoo connection for user ${userId}`)
  }

  if (isTokenExpired(tokens.tokenExpiresAt) && tokens.refreshToken) {
    const { clientId, clientSecret } = creds()
    const refreshed = await refreshAccessToken({
      tokenUrl: WAHOO_TOKEN_URL,
      clientId,
      clientSecret,
      refreshToken: tokens.refreshToken,
    })
    await storeOAuth2Tokens({ userId, provider: 'wahoo', tokens: refreshed })
    return refreshed.accessToken
  }

  return tokens.accessToken
}

// ── HTTP client ────────────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the Wahoo API.
 * Auto-refreshes the access token and revokes on 401.
 */
export async function wahooRequest<T = unknown>(
  userId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const accessToken = await getValidAccessToken(userId)
  const url = `${WAHOO_API_BASE}${path}`

  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    await revokeOAuth2Connection(userId, 'wahoo')
    throw new Error('Wahoo token revoked — re-authorisation required')
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Wahoo API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

/** Convenience wrappers */
export const wahoo = {
  get: <T>(userId: string, path: string) => wahooRequest<T>(userId, 'GET', path),
  post: <T>(userId: string, path: string, body: unknown) =>
    wahooRequest<T>(userId, 'POST', path, body),
  delete: <T>(userId: string, path: string) => wahooRequest<T>(userId, 'DELETE', path),
}
