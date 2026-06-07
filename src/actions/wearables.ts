'use server'

/**
 * Server actions for the Connected Devices settings page.
 *
 * Provides:
 *   - getConnectedDevices()  — connection status for all providers
 *   - syncDevice()           — pull activities from a provider
 *   - disconnectDevice()     — revoke & mark as revoked in DB
 */

import { auth } from '@/auth'
import { db } from '@/db'
import { wearableConnections, trainingSessions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { revokeOAuth2Connection } from '@/services/wearables/oauth2'
import { revokeGarminConnection } from '@/services/garmin/client'
import { wahooProvider } from '@/services/wahoo'
import { corosProvider } from '@/services/coros'
import type { Provider } from '@/services/wearables/types'
import type { TrainingSessionActual } from '@/services/wearables/types'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DeviceStatus {
  provider: Provider
  connected: boolean
  lastSyncAt: string | null // ISO string
  providerUserId: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) throw new Error('Unauthorised')
  return userId
}

// ── Actions ────────────────────────────────────────────────────────────────────

/**
 * Returns connection status for all three wearable providers.
 */
export async function getConnectedDevices(): Promise<DeviceStatus[]> {
  const userId = await requireUserId()
  const providers: Provider[] = ['garmin', 'wahoo', 'coros']

  const rows = await db
    .select({
      provider: wearableConnections.provider,
      status: wearableConnections.status,
      lastSyncAt: wearableConnections.lastSyncAt,
      providerUserId: wearableConnections.providerUserId,
    })
    .from(wearableConnections)
    .where(eq(wearableConnections.userId, userId))

  const rowByProvider = Object.fromEntries(rows.map((r) => [r.provider, r]))

  return providers.map((p) => {
    const row = rowByProvider[p]
    return {
      provider: p,
      connected: row?.status === 'active',
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      providerUserId: row?.providerUserId ?? null,
    }
  })
}

/**
 * Revokes a provider connection.
 */
export async function disconnectDevice(provider: Provider): Promise<{ ok: boolean }> {
  const userId = await requireUserId()

  try {
    if (provider === 'garmin') {
      await revokeGarminConnection(userId)
    } else {
      await revokeOAuth2Connection(userId, provider)
    }
    return { ok: true }
  } catch (err) {
    console.error(`[disconnectDevice] ${provider}`, err)
    return { ok: false }
  }
}

/**
 * Triggers an activity sync for a provider and upserts completed sessions.
 * Returns the number of activities synced.
 */
export async function syncDevice(provider: Provider): Promise<{ ok: boolean; synced: number }> {
  const userId = await requireUserId()

  try {
    let activities: TrainingSessionActual[] = []

    // Sync 30 days back by default
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    if (provider === 'wahoo') {
      activities = await wahooProvider.syncActivities(userId, since)
    } else if (provider === 'coros') {
      activities = await corosProvider.syncActivities(userId, since)
    } else if (provider === 'garmin') {
      // Garmin uses webhooks for push; manual pull not implemented
      return { ok: true, synced: 0 }
    }

    // Upsert: match each activity to a planned session by date + discipline
    let synced = 0
    for (const activity of activities) {
      const matched = await db
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

      if (matched.length > 0 && matched[0]) {
        await db
          .update(trainingSessions)
          .set({
            status: 'completed',
            actualData: activity.data,
            completedAt: new Date(activity.startTimestamp * 1000),
          })
          .where(eq(trainingSessions.id, matched[0].id))
        synced++
      }
    }

    return { ok: true, synced }
  } catch (err) {
    console.error(`[syncDevice] ${provider}`, err)
    return { ok: false, synced: 0 }
  }
}
