/**
 * FIT file → ParsedActivity converter.
 *
 * Parses a Garmin .FIT binary buffer and converts every session inside it to
 * our internal `ParsedActivity` type — the same shape produced by the Garmin
 * Connect webhook path (`activity-parser.ts`).
 *
 * Supported session fields (mirrors the webhook integration exactly):
 *   sport / sub_sport → discipline (via mapGarminSportType + FIT_SPORT_MAP)
 *   total_elapsed_time → durationSeconds / durationMinutes
 *   total_distance → distanceMeters
 *   avg_heart_rate → avgHr
 *   max_heart_rate → maxHr
 *   avg_power / enhanced_avg_power → avgPowerWatts
 *   normalized_power → normalizedPowerWatts
 *   avg_speed / enhanced_avg_speed → avgPaceSecPer100m (swim) / avgPaceSecPerKm (run)
 *   training_stress_score → tss
 *   total_ascent → elevationGainM
 *   total_calories → calories
 */

import FitParser from 'fit-file-parser'
import { mapGarminSportType, type ParsedActivity } from './activity-parser'

// ── Minimal local types (fit-file-parser doesn't re-export from package entry) ──

type Sport =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'transition'
  | 'multisport'
  | 'fitness_equipment'
  | 'training'
  | 'walking'
  | 'hiking'
  | 'generic'
  | string

interface FitSession {
  start_time?: string
  sport?: Sport
  sub_sport?: string
  sport_profile_name?: string
  total_elapsed_time?: number
  total_timer_time?: number
  total_distance?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_power?: number
  normalized_power?: number
  avg_speed?: number
  enhanced_avg_speed?: number
  training_stress_score?: number
  total_ascent?: number
  total_calories?: number
}

// ── FIT-native sport → discipline (complements mapGarminSportType) ─────────────
// fit-file-parser gives lowercase sport names; mapGarminSportType expects UPPER.

const FIT_SPORT_TO_GARMIN: Record<string, string> = {
  running: 'RUNNING',
  cycling: 'CYCLING',
  swimming: 'SWIMMING',
  transition: 'MULTI_SPORT',
  multisport: 'MULTI_SPORT',
  fitness_equipment: 'STRENGTH_TRAINING',
  training: 'STRENGTH_TRAINING',
  walking: 'WALKING',
  hiking: 'HIKING',
  generic: 'RUNNING', // safest fallback
}

function fitSportToDiscipline(sport: string | undefined): ParsedActivity['discipline'] {
  if (!sport) return 'run'
  const garminKey = FIT_SPORT_TO_GARMIN[sport] ?? sport.toUpperCase().replace(/\s+/g, '_')
  return mapGarminSportType(garminKey)
}

// ── Pace helpers (same logic as activity-parser.ts) ───────────────────────────

function mpsToSecPer100m(mps: number | undefined): number | undefined {
  if (!mps || mps <= 0) return undefined
  return Math.round(100 / mps)
}

function mpsToSecPerKm(mps: number | undefined): number | undefined {
  if (!mps || mps <= 0) return undefined
  return Math.round(1000 / mps)
}

// ── Session → ParsedActivity ──────────────────────────────────────────────────

function sessionToActivity(
  session: FitSession,
  filename: string,
  index: number
): ParsedActivity | null {
  // start_time is an ISO string from fit-file-parser (handles FIT epoch offset)
  if (!session.start_time) return null

  const startDate = new Date(session.start_time)
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const date = startDate.toISOString().slice(0, 10)

  const durationSec = session.total_elapsed_time ?? session.total_timer_time
  if (!durationSec || durationSec <= 0) return null

  const discipline = fitSportToDiscipline(session.sport)

  // enhanced_avg_speed is more accurate on newer devices; fall back to avg_speed
  const avgSpeed = session.enhanced_avg_speed ?? session.avg_speed

  const avgPaceSecPer100m = discipline === 'swim' ? mpsToSecPer100m(avgSpeed) : undefined
  const avgPaceSecPerKm = discipline === 'run' ? mpsToSecPerKm(avgSpeed) : undefined

  const actualData: ParsedActivity['actualData'] = {
    durationSeconds: Math.round(durationSec),
  }

  if (session.total_distance !== undefined && session.total_distance > 0)
    actualData.distanceMeters = session.total_distance
  if (session.avg_heart_rate !== undefined) actualData.avgHr = session.avg_heart_rate
  if (session.max_heart_rate !== undefined) actualData.maxHr = session.max_heart_rate
  if (session.avg_power !== undefined && session.avg_power > 0)
    actualData.avgPowerWatts = session.avg_power
  if (session.normalized_power !== undefined && session.normalized_power > 0)
    actualData.normalizedPowerWatts = session.normalized_power
  if (avgPaceSecPer100m !== undefined) actualData.avgPaceSecPer100m = avgPaceSecPer100m
  if (avgPaceSecPerKm !== undefined) actualData.avgPaceSecPerKm = avgPaceSecPerKm
  if (session.training_stress_score !== undefined) actualData.tss = session.training_stress_score
  if (session.total_ascent !== undefined && session.total_ascent > 0)
    actualData.elevationGainM = session.total_ascent
  if (session.total_calories !== undefined && session.total_calories > 0)
    actualData.calories = session.total_calories

  return {
    // garminUserId is not available from a file — caller sets this to the logged-in user's Garmin ID
    // We use a placeholder; the API route bypasses the Garmin user ID lookup entirely.
    garminUserId: '',
    garminSummaryId: `fit-import-${filename}-${index}`,
    garminActivityId: undefined,
    activityName: session.sport_profile_name ?? undefined,
    discipline,
    date,
    startTimestamp,
    durationMinutes: Math.round(durationSec / 60),
    actualData,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface FitParseResult {
  activities: ParsedActivity[]
  /** Non-fatal warnings (e.g. sessions skipped due to missing data) */
  warnings: string[]
}

/**
 * Parses a .FIT binary buffer and returns all sessions as ParsedActivity objects.
 * Throws if the binary is not a valid FIT file (CRC check disabled via `force:true`
 * for maximum compatibility with third-party exports).
 */
export async function parseFitBuffer(
  buffer: ArrayBuffer,
  filename: string
): Promise<FitParseResult> {
  const parser = new FitParser({
    force: true, // tolerate CRC errors from non-Garmin devices
    speedUnit: 'm/s', // keep speed in m/s for our pace calculators
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    mode: 'list', // sessions appear at fit.sessions[] + fit.activity.sessions[]
  })

  const fit = await parser.parseAsync(buffer)

  // Sessions are available both at the top level and nested under activity.
  // We cast because fit-file-parser doesn't re-export ParsedSession from its entry point.
  const fitAny = fit as {
    sessions?: FitSession[]
    activity?: { sessions?: FitSession[] }
  }
  const rawSessions: FitSession[] = [
    ...(fitAny.sessions ?? []),
    ...(fitAny.activity?.sessions ?? []),
  ]

  // Deduplicate by start_time (some FIT files list the same session twice)
  const seen = new Set<string>()
  const unique = rawSessions.filter((s) => {
    const key = s.start_time ?? ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const activities: ParsedActivity[] = []
  const warnings: string[] = []

  unique.forEach((session, i) => {
    const activity = sessionToActivity(session, filename, i)
    if (activity) {
      activities.push(activity)
    } else {
      warnings.push(
        `Session ${i + 1} in "${filename}" skipped: missing start_time or zero duration.`
      )
    }
  })

  return { activities, warnings }
}
