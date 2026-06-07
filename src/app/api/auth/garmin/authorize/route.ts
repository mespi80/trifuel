/**
 * GET /api/auth/garmin/authorize
 *
 * Step 1 of the Garmin OAuth 1.0a flow.
 * 1. Obtains a temporary request token from Garmin.
 * 2. Stores the request token secret in Redis (10-min TTL).
 * 3. Redirects the user's browser to Garmin's authorisation page.
 *
 * The user must be signed in; their internal user ID is included in the
 * Redis key so the callback can associate the Garmin account correctly.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { redis } from '@/lib/redis'
import { fetchRequestToken } from '@/services/garmin/oauth1'

const REQUEST_TOKEN_TTL = 10 * 60 // 10 minutes

function consumerCreds() {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET
  if (!consumerKey || !consumerSecret) {
    throw new Error('GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET must be set')
  }
  return { consumerKey, consumerSecret }
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const callbackUrl = `${appUrl}/api/auth/garmin/callback`

  let requestTokenResult
  try {
    requestTokenResult = await fetchRequestToken(consumerCreds(), callbackUrl)
  } catch (err) {
    console.error('[Garmin] fetchRequestToken failed', err)
    return NextResponse.json({ error: 'Failed to initiate Garmin auth' }, { status: 502 })
  }

  // Store: token → { secret, userId } so the callback can look it up
  const redisKey = `garmin:req_token:${requestTokenResult.token}`
  await redis.setex(
    redisKey,
    REQUEST_TOKEN_TTL,
    JSON.stringify({ secret: requestTokenResult.tokenSecret, userId })
  )

  return NextResponse.redirect(requestTokenResult.authorizeUrl)
}
