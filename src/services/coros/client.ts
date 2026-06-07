/**
 * COROS API client.
 *
 * Authenticated requests go through `corosRequest`, which auto-refreshes
 * an expired access token before the call.
 */

import {
  getOAuth2Tokens,
  storeOAuth2Tokens,
  revokeOAuth2Connection,
  isTokenExpired,
  refreshAccessToken,
} from '@/services/wearables/oauth2'

export const COROS_API_BASE = 'https://open.coros.com'
export const COROS_TOKEN_URL = `${COROS_API_BASE}/oauth2/accesstoken`

// ── Credentials ────────────────────────────────────────────────────────────────

function creds() {
  const clientId = process.env.COROS_CLIENT_ID
  const clientSecret = process.env.COROS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('COROS_CLIENT_ID and COROS_CLIENT_SECRET must be set')
  }
  return { clientId, clientSecret }
}

// ── Token management ───────────────────────────────────────────────────────────

async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getOAuth2Tokens(userId, 'coros')
  if (!tokens) {
    throw new Error(`No active COROS connection for user ${userId}`)
  }

  if (isTokenExpired(tokens.tokenExpiresAt) && tokens.refreshToken) {
    const { clientId, clientSecret } = creds()
    const refreshed = await refreshAccessToken({
      tokenUrl: COROS_TOKEN_URL,
      clientId,
      clientSecret,
      refreshToken: tokens.refreshToken,
    })
    await storeOAuth2Tokens({ userId, provider: 'coros', tokens: refreshed })
    return refreshed.accessToken
  }

  return tokens.accessToken
}

// ── HTTP client ────────────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the COROS Open Platform API.
 * COROS uses Bearer token auth via Authorization header.
 */
export async function corosRequest<T = unknown>(
  userId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const accessToken = await getValidAccessToken(userId)
  const url = `${COROS_API_BASE}${path}`

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
    await revokeOAuth2Connection(userId, 'coros')
    throw new Error('COROS token revoked — re-authorisation required')
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`COROS API ${res.status}: ${text}`)
  }

  // COROS wraps all responses in { result: "0000", message: "OK", data: ... }
  // Return the full envelope so the caller can check `result`
  return res.json() as Promise<T>
}

export const coros = {
  get: <T>(userId: string, path: string) => corosRequest<T>(userId, 'GET', path),
  post: <T>(userId: string, path: string, body: unknown) =>
    corosRequest<T>(userId, 'POST', path, body),
}
