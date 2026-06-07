/**
 * Garmin HRV data pull.
 *
 * Queries the /wellness-api/rest/dailies endpoint for HRV status fields
 * and upserts into the garmin_hrv_readings table.
 *
 * Garmin's dailies endpoint returns an array of daily summaries keyed
 * by upload time range. We extract the `hrv` sub-object from each.
 */

import { garmin } from './client'
import { db } from '@/db'
import { garminHrvReadings } from '@/db/schema'
import { and, eq, gte } from 'drizzle-orm'

// ── Garmin dailies payload types ───────────────────────────────────────────────

interface GarminHrvData {
  weeklyAverage?: number // ms
  lastNight?: number // ms — average last-night HRV
  lastNightHigh5MinHrv?: number // ms — highest 5-min HRV last night
  lastNightLow5MinHrv?: number // ms — lowest 5-min HRV last night
  hrvStatus?: string // "BALANCED" | "UNBALANCED" | "LOW" | "POOR"
  baseline?: {
    lowUpper?: number // ms — baseline low upper bound
    balancedLow?: number // ms
    balancedUpper?: number // ms
  }
  startTimestampGMT?: string
  endTimestampGMT?: string
  startTimestampLocal?: string
  endTimestampLocal?: string
}

interface GarminDailySummary {
  userId: string
  summaryId: string
  calendarDate?: string // "YYYY-MM-DD"
  startTimeInSeconds?: number
  startTimeOffsetInSeconds?: number
  averageStressLevel?: number
  hrv?: GarminHrvData
  [key: string]: unknown
}

interface GarminDailiesResponse {
  dailies?: GarminDailySummary[]
}

// ── HRV pull ───────────────────────────────────────────────────────────────────

/**
 * Pulls dailies HRV data for a time range and upserts into garmin_hrv_readings.
 *
 * @param userId     Internal user ID
 * @param startDate  ISO date string "YYYY-MM-DD" (inclusive)
 * @param endDate    ISO date string "YYYY-MM-DD" (inclusive)
 */
export async function pullGarminHrv(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ upserted: number }> {
  const startSec = Math.floor(new Date(startDate).getTime() / 1000)
  // End date: end of that day
  const endSec = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)

  const path = `/wellness-api/rest/dailies?uploadStartTimeInSeconds=${startSec}&uploadEndTimeInSeconds=${endSec}`

  const response = await garmin.get<GarminDailiesResponse>(userId, path)
  const dailies = response.dailies ?? []

  let upserted = 0

  for (const daily of dailies) {
    if (!daily.hrv) continue

    // Derive the calendar date
    const date =
      daily.calendarDate ??
      deriveLocalDate(daily.startTimeInSeconds, daily.startTimeOffsetInSeconds)
    if (!date) continue

    const { hrv, averageStressLevel } = daily

    // Derive baseline midpoint for storage (use balancedLow if present)
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

    upserted++
  }

  return { upserted }
}

/** Pull HRV for the last N days. Defaults to 7. */
export async function pullRecentGarminHrv(userId: string, days = 7): Promise<{ upserted: number }> {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))

  return pullGarminHrv(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
}

/**
 * Returns the most recent HRV reading for a user from the DB.
 * Used by the adaptive replanning engine.
 */
export async function getLatestHrvReading(userId: string) {
  const rows = await db
    .select()
    .from(garminHrvReadings)
    .where(eq(garminHrvReadings.userId, userId))
    .orderBy(garminHrvReadings.date)
    .limit(1)

  return rows[0] ?? null
}

/**
 * Returns HRV readings for the last N days.
 */
export async function getHrvHistory(
  userId: string,
  days = 28
): Promise<(typeof garminHrvReadings.$inferSelect)[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  return db
    .select()
    .from(garminHrvReadings)
    .where(and(eq(garminHrvReadings.userId, userId), gte(garminHrvReadings.date, cutoffDate)))
    .orderBy(garminHrvReadings.date)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveLocalDate(
  startTimeInSeconds: number | undefined,
  offsetSeconds: number | undefined
): string | undefined {
  if (startTimeInSeconds === undefined) return undefined
  const localMs = (startTimeInSeconds + (offsetSeconds ?? 0)) * 1000
  return new Date(localMs).toISOString().slice(0, 10)
}
