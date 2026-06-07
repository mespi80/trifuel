/**
 * POST /api/webhooks/garmin
 *
 * Receives push notifications from Garmin Health API.
 * Supported payload types:
 *   - activitySummaries  → parsed and matched to training_sessions
 *   - dailies            → HRV data upserted to garmin_hrv_readings
 *   - deregistrations    → wearable connection revoked
 *
 * Security: Garmin signs the request body with HMAC-SHA1 using the consumer
 * secret. We verify the X-Garmin-Signature header before processing anything.
 *
 * We return 200 immediately after signature verification. The actual DB work
 * happens in the same request but errors are logged rather than re-thrown,
 * so Garmin does not see 5xx errors that would cause retries.
 */

import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import {
  parseActivityWebhookPayload,
  type GarminActivityWebhookPayload,
} from '@/services/garmin/activity-parser'
import { getUserIdByGarminUserId, revokeGarminConnection } from '@/services/garmin/client'
import { db } from '@/db'
import { trainingSessions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { garminHrvReadings } from '@/db/schema'

// ── Signature verification ─────────────────────────────────────────────────────

/**
 * Garmin signs the raw request body with HMAC-SHA1 using the consumer secret.
 * Header: X-Garmin-Signature: <hex-digest>
 */
function verifyGarminSignature(rawBody: string, signature: string): boolean {
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET
  if (!consumerSecret) return false

  const expected = createHmac('sha1', consumerSecret).update(rawBody, 'utf8').digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

// ── Deregistration handler ─────────────────────────────────────────────────────

interface GarminDeregistration {
  userId: string
  userAccessToken: string
}

async function handleDeregistrations(deregistrations: GarminDeregistration[]): Promise<void> {
  for (const entry of deregistrations) {
    const userId = await getUserIdByGarminUserId(entry.userId)
    if (!userId) continue
    await revokeGarminConnection(userId).catch((err) =>
      console.error('[Garmin webhook] deregistration revoke failed', err)
    )
  }
}

// ── Activity handler ───────────────────────────────────────────────────────────

async function handleActivities(payload: GarminActivityWebhookPayload): Promise<void> {
  const activities = parseActivityWebhookPayload(payload)

  for (const activity of activities) {
    const userId = await getUserIdByGarminUserId(activity.garminUserId)
    if (!userId) {
      console.warn('[Garmin webhook] unknown garminUserId', activity.garminUserId)
      continue
    }

    // Try to find a matching planned session for the same date + discipline
    const existing = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.date, activity.date),
          eq(trainingSessions.discipline, activity.discipline),
          eq(trainingSessions.status, 'planned')
        )
      )
      .limit(1)

    if (existing.length > 0 && existing[0]) {
      // Update the planned session with actual data
      await db
        .update(trainingSessions)
        .set({
          status: 'completed',
          actualData: activity.actualData,
          completedAt: new Date(activity.startTimestamp * 1000),
        })
        .where(eq(trainingSessions.id, existing[0].id))
    }
    // If no matching planned session, we skip — unplanned activities could be
    // inserted into a catch-all plan in a future iteration.
  }
}

// ── Dailies / HRV handler ──────────────────────────────────────────────────────

interface GarminDailyEntry {
  userId: string
  calendarDate?: string
  startTimeInSeconds?: number
  startTimeOffsetInSeconds?: number
  averageStressLevel?: number
  hrv?: {
    weeklyAverage?: number
    lastNightHigh5MinHrv?: number
    lastNightLow5MinHrv?: number
    hrvStatus?: string
    baseline?: { lowUpper?: number; balancedLow?: number; balancedUpper?: number }
  }
}

interface GarminDailiesPayload {
  dailies?: GarminDailyEntry[]
}

async function handleDailies(payload: GarminDailiesPayload): Promise<void> {
  const dailies = payload.dailies ?? []

  for (const daily of dailies) {
    if (!daily.hrv) continue

    const userId = await getUserIdByGarminUserId(daily.userId)
    if (!userId) continue

    const offsetSec = daily.startTimeOffsetInSeconds ?? 0
    const date =
      daily.calendarDate ??
      (daily.startTimeInSeconds !== undefined
        ? new Date((daily.startTimeInSeconds + offsetSec) * 1000).toISOString().slice(0, 10)
        : undefined)

    if (!date) continue

    const { hrv, averageStressLevel } = daily
    const baselineMs = hrv.baseline?.balancedLow ?? hrv.baseline?.lowUpper

    await db
      .insert(garminHrvReadings)
      .values({
        userId,
        date,
        weeklyAvgMs: hrv.weeklyAverage,
        lastNightHighMs: hrv.lastNightHigh5MinHrv,
        lastNightLowMs: hrv.lastNightLow5MinHrv,
        status: hrv.hrvStatus,
        baselineMs,
        avgStressLevel:
          averageStressLevel !== undefined ? Math.round(averageStressLevel) : undefined,
        rawPayload: hrv,
        pulledAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [garminHrvReadings.userId, garminHrvReadings.date],
        set: {
          weeklyAvgMs: hrv.weeklyAverage,
          lastNightHighMs: hrv.lastNightHigh5MinHrv,
          lastNightLowMs: hrv.lastNightLow5MinHrv,
          status: hrv.hrvStatus,
          baselineMs,
          avgStressLevel:
            averageStressLevel !== undefined ? Math.round(averageStressLevel) : undefined,
          rawPayload: hrv,
          pulledAt: new Date(),
        },
      })
      .catch((err) => console.error('[Garmin webhook] HRV upsert failed', err))
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const sigHeader = request.headers.get('x-garmin-signature') ?? ''

  if (!verifyGarminSignature(rawBody, sigHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Respond 200 quickly — Garmin expects acknowledgement within a few seconds
  // All dispatch is done synchronously in this request but failures are caught.
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Dispatch based on payload keys (all can be present in a single payload)
  const dispatches: Promise<void>[] = []

  if ('activitySummaries' in parsed) {
    dispatches.push(
      handleActivities(parsed as GarminActivityWebhookPayload).catch((err) =>
        console.error('[Garmin webhook] activity handling failed', err)
      )
    )
  }

  if ('dailies' in parsed) {
    dispatches.push(
      handleDailies(parsed as GarminDailiesPayload).catch((err) =>
        console.error('[Garmin webhook] dailies handling failed', err)
      )
    )
  }

  if ('deregistrations' in parsed) {
    dispatches.push(
      handleDeregistrations(
        (parsed as { deregistrations: GarminDeregistration[] }).deregistrations
      ).catch((err) => console.error('[Garmin webhook] deregistration handling failed', err))
    )
  }

  await Promise.allSettled(dispatches)

  return NextResponse.json({ ok: true })
}
