/**
 * OAuth 1.0a implementation for Garmin Connect.
 *
 * Garmin uses HMAC-SHA1 signatures on HTTPS. The flow is:
 *   1. POST /oauth-service/oauth/request_token  → request token + secret
 *   2. Redirect user to /oauthConfirm?oauth_token=...
 *   3. User authorises; Garmin redirects to callback with oauth_token + oauth_verifier
 *   4. POST /oauth-service/oauth/access_token    → access token + secret + userId
 */

import { createHmac, randomBytes } from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OAuth1Credentials {
  consumerKey: string
  consumerSecret: string
  /** Absent when generating the request-token signature */
  accessToken?: string
  accessTokenSecret?: string
}

export interface RequestTokenResult {
  token: string
  tokenSecret: string
  authorizeUrl: string
}

export interface AccessTokenResult {
  accessToken: string
  accessTokenSecret: string
  /** Garmin returns this as `oauth_user_id` */
  providerUserId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Percent-encode per RFC 3986 (stricter than encodeURIComponent) */
export function pct(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

/** Generate a cryptographic nonce */
export function nonce(): string {
  return randomBytes(16).toString('hex')
}

/** Current Unix timestamp as a string */
export function timestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

// ── Signature ─────────────────────────────────────────────────────────────────

/**
 * Builds the OAuth 1.0a `Authorization` header value for a request.
 *
 * @param method      HTTP verb (GET, POST, …)
 * @param url         Full request URL including query string
 * @param creds       Consumer key/secret and optional access token/secret
 * @param extraParams Additional OAuth params (e.g. oauth_callback, oauth_verifier)
 */
export function buildAuthHeader(
  method: string,
  url: string,
  creds: OAuth1Credentials,
  extraParams: Record<string, string> = {}
): string {
  const ts = timestamp()
  const nc = nonce()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nc,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_version: '1.0',
    ...extraParams,
  }
  if (creds.accessToken) {
    oauthParams['oauth_token'] = creds.accessToken
  }

  // Collect OAuth params + URL query params for the signature base string
  const urlObj = new URL(url)
  const allParams: Record<string, string> = { ...oauthParams }
  for (const [k, v] of urlObj.searchParams.entries()) {
    allParams[k] = v
  }

  const normalizedParams = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join('&')

  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
  const signingBase = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(normalizedParams)}`

  const signingKey = `${pct(creds.consumerSecret)}&${pct(creds.accessTokenSecret ?? '')}`
  const signature = createHmac('sha1', signingKey).update(signingBase).digest('base64')

  oauthParams['oauth_signature'] = signature

  return (
    'OAuth ' +
    Object.entries(oauthParams)
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(', ')
  )
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

/**
 * Parses an `application/x-www-form-urlencoded` OAuth response body.
 */
export function parseOAuthBody(body: string): Record<string, string> {
  return Object.fromEntries(
    body
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const eqIdx = pair.indexOf('=')
        const k = decodeURIComponent(pair.slice(0, eqIdx))
        const v = decodeURIComponent(pair.slice(eqIdx + 1))
        return [k, v] as [string, string]
      })
  )
}

// ── Token flow ────────────────────────────────────────────────────────────────

const CONNECT_API = 'https://connectapi.garmin.com'
const CONNECT_AUTH = 'https://connect.garmin.com'

export const ENDPOINTS = {
  requestToken: `${CONNECT_API}/oauth-service/oauth/request_token`,
  accessToken: `${CONNECT_API}/oauth-service/oauth/access_token`,
  authorize: `${CONNECT_AUTH}/oauthConfirm`,
} as const

/**
 * Step 1: Obtain a temporary request token.
 * `callbackUrl` must be registered in the Garmin developer portal.
 */
export async function fetchRequestToken(
  creds: Pick<OAuth1Credentials, 'consumerKey' | 'consumerSecret'>,
  callbackUrl: string
): Promise<RequestTokenResult> {
  const authHeader = buildAuthHeader('POST', ENDPOINTS.requestToken, creds, {
    oauth_callback: callbackUrl,
  })

  const res = await fetch(ENDPOINTS.requestToken, {
    method: 'POST',
    headers: { Authorization: authHeader },
  })

  if (!res.ok) {
    throw new Error(`Garmin request token failed: ${res.status} ${await res.text()}`)
  }

  const params = parseOAuthBody(await res.text())
  if (!params['oauth_token'] || !params['oauth_token_secret']) {
    throw new Error('Garmin returned invalid request token response')
  }

  return {
    token: params['oauth_token'],
    tokenSecret: params['oauth_token_secret'],
    authorizeUrl: `${ENDPOINTS.authorize}?oauth_token=${params['oauth_token']}`,
  }
}

/**
 * Step 4: Exchange a verified request token for a long-lived access token.
 */
export async function fetchAccessToken(
  creds: Pick<OAuth1Credentials, 'consumerKey' | 'consumerSecret'>,
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<AccessTokenResult> {
  const authHeader = buildAuthHeader(
    'POST',
    ENDPOINTS.accessToken,
    {
      ...creds,
      accessToken: requestToken,
      accessTokenSecret: requestTokenSecret,
    },
    { oauth_verifier: verifier }
  )

  const res = await fetch(ENDPOINTS.accessToken, {
    method: 'POST',
    headers: { Authorization: authHeader },
  })

  if (!res.ok) {
    throw new Error(`Garmin access token failed: ${res.status} ${await res.text()}`)
  }

  const params = parseOAuthBody(await res.text())
  if (!params['oauth_token'] || !params['oauth_token_secret']) {
    throw new Error('Garmin returned invalid access token response')
  }

  return {
    accessToken: params['oauth_token'],
    accessTokenSecret: params['oauth_token_secret'],
    // Garmin returns oauth_user_id alongside the access token
    providerUserId: params['oauth_user_id'] ?? params['oauth_token'],
  }
}
