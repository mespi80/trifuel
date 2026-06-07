/**
 * GET /api/auth/garmin/callback?oauth_token=...&oauth_verifier=...
 *
 * Step 3 of the Garmin OAuth 1.0a flow (Garmin redirects the user here after
 * they approve access).
 * 1. Reads the stored request token secret from Redis.
 * 2. Exchanges the verified request token for a long-lived access token.
 * 3. Persists the encrypted tokens in wearable_connections.
 * 4. Redirects the user to the dashboard.
 */

import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { fetchAccessToken } from '@/services/garmin/oauth1'
import { storeGarminTokens } from '@/services/garmin/client'
import { db } from '@/db'
import { wearableConnections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

function consumerCreds() {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET
  if (!consumerKey || !consumerSecret) {
    throw new Error('GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET must be set')
  }
  return { consumerKey, consumerSecret }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.json({ error: 'Missing oauth_token or oauth_verifier' }, { status: 400 })
  }

  // Retrieve stored request token data
  const redisKey = `garmin:req_token:${oauthToken}`
  const raw = await redis.get(redisKey)
  if (!raw) {
    return NextResponse.json(
      { error: 'Request token expired or not found — please try again' },
      { status: 400 }
    )
  }

  let stored: { secret: string; userId: string }
  try {
    stored = JSON.parse(raw) as { secret: string; userId: string }
  } catch {
    return NextResponse.json({ error: 'Invalid session data' }, { status: 500 })
  }

  // Exchange for access token
  let accessTokenResult
  try {
    accessTokenResult = await fetchAccessToken(
      consumerCreds(),
      oauthToken,
      stored.secret,
      oauthVerifier
    )
  } catch (err) {
    console.error('[Garmin] fetchAccessToken failed', err)
    return NextResponse.json({ error: 'Failed to complete Garmin auth' }, { status: 502 })
  }

  // Persist tokens
  await storeGarminTokens(
    stored.userId,
    accessTokenResult.accessToken,
    accessTokenResult.accessTokenSecret,
    accessTokenResult.providerUserId
  )

  // Update lastSyncAt
  await db
    .update(wearableConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(wearableConnections.userId, stored.userId), eq(wearableConnections.provider, 'garmin'))
    )

  // Clean up Redis key
  await redis.del(redisKey).catch(() => null)

  // Redirect to dashboard settings / wearables page
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  return NextResponse.redirect(`${appUrl}/en/dashboard/settings?garmin=connected`)
}
