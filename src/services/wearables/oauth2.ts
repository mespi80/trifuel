/**
 * Shared OAuth 2.0 helpers used by Wahoo and COROS.
 *
 * Implements the Authorization Code flow with optional PKCE.
 * State (+ optional PKCE verifier) is stored in Redis with a 10-minute TTL.
 */

import { createHash, randomBytes } from 'crypto'
import { redis } from '@/lib/redis'
import { db } from '@/db'
import { wearableConnections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { encrypt, decrypt } from '@/services/garmin/crypto'
import type { Provider } from './types'

const STATE_TTL = 10 * 60 // 10 minutes

// ── PKCE helpers ───────────────────────────────────────────────────────────────

/** Generate a URL-safe random code verifier (RFC 7636) */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

/** Derive the code challenge from a verifier (S256 method) */
export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ── Authorization URL builder ──────────────────────────────────────────────────

export interface AuthorizeParams {
  provider: Provider
  userId: string
  authUrl: string
  clientId: string
  redirectUri: string
  scope: string
  usePkce?: boolean
  /** Extra query params appended verbatim */
  extra?: Record<string, string>
}

/**
 * Generates the full authorization redirect URL and stores state in Redis.
 * Returns: { redirectUrl, state }
 */
export async function buildAuthorizeUrl(params: AuthorizeParams): Promise<string> {
  const { provider, userId, authUrl, clientId, redirectUri, scope, usePkce = false, extra } = params

  const state = randomBytes(16).toString('hex')
  const statePayload: Record<string, string> = { userId, provider }

  let codeVerifier: string | undefined
  if (usePkce) {
    codeVerifier = generateCodeVerifier()
    statePayload['codeVerifier'] = codeVerifier
  }

  await redis.setex(`oauth2:state:${state}`, STATE_TTL, JSON.stringify(statePayload))

  const url = new URL(authUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', state)

  if (usePkce && codeVerifier) {
    url.searchParams.set('code_challenge', deriveCodeChallenge(codeVerifier))
    url.searchParams.set('code_challenge_method', 'S256')
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      url.searchParams.set(k, v)
    }
  }

  return url.toString()
}

// ── State retrieval ────────────────────────────────────────────────────────────

export interface StoredOAuthState {
  userId: string
  provider: Provider
  codeVerifier?: string
}

/**
 * Reads and deletes the stored OAuth state from Redis.
 * Returns null if the state is expired or not found.
 */
export async function consumeOAuthState(state: string): Promise<StoredOAuthState | null> {
  const key = `oauth2:state:${state}`
  const raw = await redis.get(key)
  if (!raw) return null
  await redis.del(key).catch(() => null)

  try {
    return JSON.parse(raw) as StoredOAuthState
  } catch {
    return null
  }
}

// ── Token exchange ─────────────────────────────────────────────────────────────

export interface TokenResponse {
  accessToken: string
  refreshToken?: string
  expiresInSeconds?: number
  tokenType: string
  scope?: string
}

export interface ExchangeCodeParams {
  tokenUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
  codeVerifier?: string
}

/**
 * Exchanges an authorization code for access/refresh tokens.
 */
export async function exchangeCode(params: ExchangeCodeParams): Promise<TokenResponse> {
  const { tokenUrl, clientId, clientSecret, redirectUri, code, codeVerifier } = params

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  })
  if (codeVerifier) body.set('code_verifier', codeVerifier)

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth2 token exchange failed (${res.status}): ${text}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return normaliseTokenResponse(json)
}

// ── Token refresh ──────────────────────────────────────────────────────────────

export interface RefreshTokenParams {
  tokenUrl: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

export async function refreshAccessToken(params: RefreshTokenParams): Promise<TokenResponse> {
  const { tokenUrl, clientId, clientSecret, refreshToken } = params

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth2 token refresh failed (${res.status}): ${text}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return normaliseTokenResponse(json)
}

function normaliseTokenResponse(json: Record<string, unknown>): TokenResponse {
  const accessToken = json['access_token'] as string | undefined
  const refreshToken = json['refresh_token'] as string | undefined
  const expiresIn = json['expires_in'] as number | string | undefined
  const tokenType = (json['token_type'] as string | undefined) ?? 'bearer'
  const scope = json['scope'] as string | undefined

  if (!accessToken) {
    throw new Error('OAuth2 response missing access_token')
  }

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: expiresIn !== undefined ? Number(expiresIn) : undefined,
    tokenType,
    scope,
  }
}

// ── Token persistence helpers ──────────────────────────────────────────────────

export interface StoreTokensParams {
  userId: string
  provider: Provider
  providerUserId?: string
  tokens: TokenResponse
}

/** Upserts encrypted tokens in `wearable_connections`. */
export async function storeOAuth2Tokens(params: StoreTokensParams): Promise<void> {
  const { userId, provider, providerUserId, tokens } = params

  const expiresAt = tokens.expiresInSeconds
    ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
    : undefined

  await db
    .insert(wearableConnections)
    .values({
      userId,
      provider,
      providerUserId: providerUserId ?? null,
      accessTokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiresAt: expiresAt ?? null,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [wearableConnections.userId, wearableConnections.provider],
      set: {
        providerUserId: providerUserId ?? undefined,
        accessTokenEncrypted: encrypt(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        tokenExpiresAt: expiresAt ?? null,
        status: 'active',
        updatedAt: new Date(),
      },
    })
}

export interface StoredTokens {
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: Date | null
  providerUserId: string | null
}

/** Retrieves and decrypts tokens for a user + provider. Returns null if not connected. */
export async function getOAuth2Tokens(
  userId: string,
  provider: Provider
): Promise<StoredTokens | null> {
  const rows = await db
    .select()
    .from(wearableConnections)
    .where(
      and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, provider),
        eq(wearableConnections.status, 'active')
      )
    )
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]!

  return {
    accessToken: decrypt(row.accessTokenEncrypted),
    refreshToken: row.refreshTokenEncrypted ? decrypt(row.refreshTokenEncrypted) : null,
    tokenExpiresAt: row.tokenExpiresAt,
    providerUserId: row.providerUserId,
  }
}

/** Marks a connection as revoked. */
export async function revokeOAuth2Connection(userId: string, provider: Provider): Promise<void> {
  await db
    .update(wearableConnections)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)))
}

/** Returns true if the access token is expired (or expires within 60 seconds). */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return Date.now() >= expiresAt.getTime() - 60_000
}
