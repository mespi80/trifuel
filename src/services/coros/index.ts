/**
 * COROS wearable provider — implements the WearableProvider interface.
 *
 * OAuth 2.0 (Authorization Code flow).
 * Activity sync pulls from GET /v2/coros/sport/list.
 * Workout push is not supported by COROS Open Platform.
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
import { coros } from './client'
import { parseCorosSportListResponse, type CorosSportListResponse } from './activity-parser'
import { pushWorkoutToCoros } from './workout-push'
import type {
  WearableProvider,
  TrainingSessionActual,
  SessionToSerialize,
} from '@/services/wearables/types'
import { COROS_TOKEN_URL } from './client'

// ── Constants ──────────────────────────────────────────────────────────────────

const COROS_AUTH_URL = 'https://open.coros.com/oauth2/authorize'
const COROS_SCOPE = 'activity'
const PROVIDER = 'coros' as const

function creds() {
  const clientId = process.env.COROS_CLIENT_ID
  const clientSecret = process.env.COROS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('COROS_CLIENT_ID and COROS_CLIENT_SECRET must be set')
  }
  return { clientId, clientSecret }
}

function appUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** Format Date as "YYYYMMDD" (COROS date param format) */
function toCorosDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ── Provider implementation ────────────────────────────────────────────────────

export const corosProvider: WearableProvider = {
  async authorize(userId: string, request: Request): Promise<Response> {
    const { clientId } = creds()
    const redirectUri = `${appUrl(request)}/api/auth/coros/callback`

    const redirectUrl = await buildAuthorizeUrl({
      provider: PROVIDER,
      userId,
      authUrl: COROS_AUTH_URL,
      clientId,
      redirectUri,
      scope: COROS_SCOPE,
    })

    return NextResponse.redirect(redirectUrl)
  },

  async handleCallback(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('[COROS] auth error:', error)
      return NextResponse.redirect(
        `${appUrl(request)}/en/dashboard/settings/devices?error=coros_denied`
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
    const redirectUri = `${appUrl(request)}/api/auth/coros/callback`

    const tokens = await exchangeCode({
      tokenUrl: COROS_TOKEN_URL,
      clientId,
      clientSecret,
      redirectUri,
      code,
    })

    await storeOAuth2Tokens({ userId: stored.userId, provider: PROVIDER, tokens })

    await db
      .update(wearableConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(wearableConnections.userId, stored.userId),
          eq(wearableConnections.provider, PROVIDER)
        )
      )

    return NextResponse.redirect(`${appUrl(request)}/en/dashboard/settings/devices?coros=connected`)
  },

  async syncActivities(userId: string, since?: Date): Promise<TrainingSessionActual[]> {
    const sinceDate = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = new Date()

    const allActivities: TrainingSessionActual[] = []
    let pageIndex = 1
    const pageSize = 50

    while (true) {
      const path =
        `/v2/coros/sport/list.json` +
        `?startDate=${toCorosDate(sinceDate)}` +
        `&endDate=${toCorosDate(endDate)}` +
        `&size=${pageSize}` +
        `&pageIndex=${pageIndex}`

      const response = await coros.get<CorosSportListResponse>(userId, path)

      // COROS result code "0000" = success; anything else = error/empty
      if (response.result !== '0000') break

      const entries = response.data?.sportDataList ?? []
      if (entries.length === 0) break

      const activities = parseCorosSportListResponse(response, userId)
      allActivities.push(...activities)

      const totalPages = response.data?.totalPage ?? 1
      if (pageIndex >= totalPages || entries.length < pageSize) break
      pageIndex++
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
    return pushWorkoutToCoros(userId, session, name)
  },
}
