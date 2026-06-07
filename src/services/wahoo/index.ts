/**
 * Wahoo wearable provider — implements the WearableProvider interface.
 *
 * OAuth 2.0 (Authorization Code, no PKCE required by Wahoo).
 * Activity sync pulls from GET /v1/workouts since a given date.
 * Workout push sends to POST /v1/planned_workouts.
 */

import { NextResponse } from 'next/server'
import {
  buildAuthorizeUrl,
  consumeOAuthState,
  exchangeCode,
  storeOAuth2Tokens,
} from '@/services/wearables/oauth2'
import { db } from '@/db'
import { wearableConnections } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { wahoo } from './client'
import { parseWahooWorkoutsResponse, type WahooWorkoutsResponse } from './activity-parser'
import { pushWorkoutToWahoo } from './workout-push'
import type {
  WearableProvider,
  TrainingSessionActual,
  SessionToSerialize,
} from '@/services/wearables/types'
import { WAHOO_TOKEN_URL } from './client'

// ── Constants ──────────────────────────────────────────────────────────────────

const WAHOO_AUTH_URL = 'https://api.wahooligan.com/oauth/authorize'
const WAHOO_SCOPE = 'workouts_read user_read'
const PROVIDER = 'wahoo' as const

function creds() {
  const clientId = process.env.WAHOO_CLIENT_ID
  const clientSecret = process.env.WAHOO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('WAHOO_CLIENT_ID and WAHOO_CLIENT_SECRET must be set')
  }
  return { clientId, clientSecret }
}

function appUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
}

// ── Provider implementation ────────────────────────────────────────────────────

export const wahooProvider: WearableProvider = {
  async authorize(userId: string, request: Request): Promise<Response> {
    const { clientId } = creds()
    const redirectUri = `${appUrl(request)}/api/auth/wahoo/callback`

    const redirectUrl = await buildAuthorizeUrl({
      provider: PROVIDER,
      userId,
      authUrl: WAHOO_AUTH_URL,
      clientId,
      redirectUri,
      scope: WAHOO_SCOPE,
    })

    return NextResponse.redirect(redirectUrl)
  },

  async handleCallback(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('[Wahoo] auth error:', error)
      return NextResponse.redirect(
        `${appUrl(request)}/en/dashboard/settings/devices?error=wahoo_denied`
      )
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    const stored = await consumeOAuthState(state)
    if (!stored || stored.provider !== PROVIDER) {
      return NextResponse.json({ error: 'Invalid or expired OAuth state' }, { status: 400 })
    }

    const { clientId, clientSecret } = creds()
    const redirectUri = `${appUrl(request)}/api/auth/wahoo/callback`

    const tokens = await exchangeCode({
      tokenUrl: WAHOO_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri,
      code,
    })

    await storeOAuth2Tokens({ userId: stored.userId, provider: PROVIDER, tokens })

    // Update lastSyncAt
    await db
      .update(wearableConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(wearableConnections.userId, stored.userId),
          eq(wearableConnections.provider, PROVIDER)
        )
      )

    return NextResponse.redirect(`${appUrl(request)}/en/dashboard/settings/devices?wahoo=connected`)
  },

  async syncActivities(userId: string, since?: Date): Promise<TrainingSessionActual[]> {
    const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const allActivities: TrainingSessionActual[] = []
    let page = 1
    const perPage = 25

    // Paginate until we reach activities older than `since`
    while (true) {
      const response = await wahoo.get<WahooWorkoutsResponse>(
        userId,
        `/v1/workouts?page=${page}&per_page=${perPage}&order_dir=desc`
      )

      const items = response.workouts?.items ?? []
      if (items.length === 0) break

      const activities = parseWahooWorkoutsResponse(response, userId)

      let reachedOld = false
      for (const activity of activities) {
        if (new Date(activity.date) < sinceDate) {
          reachedOld = true
          break
        }
        allActivities.push(activity)
      }

      if (reachedOld || items.length < perPage) break
      page++
    }

    // Update lastSyncAt
    await db
      .update(wearableConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, PROVIDER))
      )

    return allActivities
  },

  async pushWorkout(userId: string, session: SessionToSerialize, name: string): Promise<string> {
    const planDate = new Date().toISOString().slice(0, 10)
    return pushWorkoutToWahoo(userId, session, name, planDate)
  },
}
