/**
 * Garmin Health API client.
 *
 * Handles token storage/retrieval (encrypted), authenticated requests,
 * and rate limiting. All external Garmin calls go through `garminRequest`.
 */

import { encrypt, decrypt } from './crypto'
import { buildAuthHeader } from './oauth1'
import type { OAuth1Credentials } from './oauth1'
import { withGarminRateLimit } from './rate-limiter'
import { db } from '@/db'
import { wearableConnections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// ── Constants ─────────────────────────────────────────────────────────────────

export const GARMIN_API_BASE = 'https://apis.garmin.com'

// ── Internal helpers ──────────────────────────────────────────────────────────

function consumerCredentials(): Pick<OAuth1Credentials, 'consumerKey' | 'consumerSecret'> {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET
  if (!consumerKey || !consumerSecret) {
    throw new Error('GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET must be set')
  }
  return { consumerKey, consumerSecret }
}

// ── Token persistence ─────────────────────────────────────────────────────────

/**
 * Stores (upserts) Garmin OAuth tokens for a user.
 * Both access token and token secret are AES-256-GCM encrypted at rest.
 */
export async function storeGarminTokens(
  userId: string,
  accessToken: string,
  accessTokenSecret: string,
  providerUserId: string
): Promise<void> {
  await db
    .insert(wearableConnections)
    .values({
      userId,
      provider: 'garmin',
      providerUserId,
      accessTokenEncrypted: encrypt(accessToken),
      refreshTokenEncrypted: encrypt(accessTokenSecret),
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [wearableConnections.userId, wearableConnections.provider],
      set: {
        providerUserId,
        accessTokenEncrypted: encrypt(accessToken),
        refreshTokenEncrypted: encrypt(accessTokenSecret),
        status: 'active',
        updatedAt: new Date(),
      },
    })
}

/**
 * Retrieves and decrypts Garmin tokens for a user.
 * Returns null if no active connection exists.
 */
export async function getGarminTokens(
  userId: string
): Promise<{
  accessToken: string
  accessTokenSecret: string
  providerUserId: string | null
} | null> {
  const rows = await db
    .select()
    .from(wearableConnections)
    .where(
      and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, 'garmin'),
        eq(wearableConnections.status, 'active')
      )
    )
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]!

  if (!row.refreshTokenEncrypted) {
    throw new Error('Garmin token secret missing — re-authorisation required')
  }

  return {
    accessToken: decrypt(row.accessTokenEncrypted),
    accessTokenSecret: decrypt(row.refreshTokenEncrypted),
    providerUserId: row.providerUserId,
  }
}

/**
 * Marks a Garmin connection as revoked (e.g. on 401 response).
 */
export async function revokeGarminConnection(userId: string): Promise<void> {
  await db
    .update(wearableConnections)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, 'garmin')))
}

/**
 * Looks up the internal user ID from a Garmin provider user ID.
 * Used in webhook handlers where only the Garmin userId is known.
 */
export async function getUserIdByGarminUserId(providerUserId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: wearableConnections.userId })
    .from(wearableConnections)
    .where(
      and(
        eq(wearableConnections.provider, 'garmin'),
        eq(wearableConnections.providerUserId, providerUserId),
        eq(wearableConnections.status, 'active')
      )
    )
    .limit(1)

  return rows[0]?.userId ?? null
}

// ── HTTP client ───────────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the Garmin Health API.
 *
 * - Rate-limited: 15 req / 15-min per user
 * - Automatically revokes connection on 401 (token revoked at Garmin)
 * - Throws on non-2xx responses (caller should handle)
 */
export async function garminRequest<T = unknown>(
  userId: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const tokens = await getGarminTokens(userId)
  if (!tokens) {
    throw new Error(`No active Garmin connection for user ${userId}`)
  }

  const url = `${GARMIN_API_BASE}${path}`
  const creds: OAuth1Credentials = {
    ...consumerCredentials(),
    accessToken: tokens.accessToken,
    accessTokenSecret: tokens.accessTokenSecret,
  }

  return withGarminRateLimit(userId, async () => {
    const authHeader = buildAuthHeader(method.toUpperCase(), url, creds)

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      await revokeGarminConnection(userId)
      throw new Error('Garmin token revoked — re-authorisation required')
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return {} as T
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Garmin API ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  })
}

/**
 * Convenience wrappers for common HTTP verbs.
 */
export const garmin = {
  get: <T>(userId: string, path: string) => garminRequest<T>(userId, 'GET', path),
  post: <T>(userId: string, path: string, body: unknown) =>
    garminRequest<T>(userId, 'POST', path, body),
  put: <T>(userId: string, path: string, body: unknown) =>
    garminRequest<T>(userId, 'PUT', path, body),
  delete: <T>(userId: string, path: string) => garminRequest<T>(userId, 'DELETE', path),
}
