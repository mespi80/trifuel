/**
 * Garmin activity webhook payload parser.
 *
 * Converts Garmin's activitySummary shape into our internal `ParsedActivity`
 * type, which can then be matched against a planned `TrainingSession` or
 * inserted as a new completed session.
 *
 * This module is pure (no DB calls) so it is easy to unit test.
 */

// ── Garmin payload types ───────────────────────────────────────────────────────

/** Subset of Garmin's activitySummary object we care about. */
export interface GarminActivitySummary {
  userId: string // Garmin provider user ID
  summaryId: string
  activityId?: number
  activityName?: string
  activityType: string // e.g. "RUNNING", "CYCLING", "SWIMMING"
  startTimeInSeconds: number
  startTimeOffsetInSeconds?: number
  durationInSeconds: number
  distanceInMeters?: number
  averageSpeedInMetersPerSecond?: number
  averageHeartRateInBeatsPerMinute?: number
  maxHeartRateInBeatsPerMinute?: number
  averagePowerInWatts?: number
  maxPowerInWatts?: number
  normalizedPowerInWatts?: number
  totalElevationGainInMeters?: number
  calories?: number
  trainingStressScore?: number
  lapData?: GarminLap[]
  samples?: unknown // GPS/sensor data — stored raw in actualData
}

export interface GarminLap {
  startTimeInSeconds: number
  durationInSeconds: number
  distanceInMeters?: number
  averageHeartRateInBeatsPerMinute?: number
  averagePowerInWatts?: number
}

/** Webhook POST body */
export interface GarminActivityWebhookPayload {
  activitySummaries?: GarminActivitySummary[]
}

// ── Internal discipline mapping ────────────────────────────────────────────────

type Discipline = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'recovery'

const GARMIN_SPORT_MAP: Record<string, Discipline> = {
  // Running
  RUNNING: 'run',
  TRAIL_RUNNING: 'run',
  TREADMILL_RUNNING: 'run',
  TRACK_RUNNING: 'run',
  VIRTUAL_RUN: 'run',

  // Cycling
  CYCLING: 'bike',
  MOUNTAIN_BIKING: 'bike',
  ROAD_BIKING: 'bike',
  INDOOR_CYCLING: 'bike',
  GRAVEL_CYCLING: 'bike',
  VIRTUAL_RIDE: 'bike',
  E_BIKE_MOUNTAIN: 'bike',

  // Swimming
  SWIMMING: 'swim',
  OPEN_WATER_SWIMMING: 'swim',
  POOL_SWIMMING: 'swim',
  LAP_SWIMMING: 'swim',

  // Multi-sport / Brick
  MULTI_SPORT: 'brick',
  TRIATHLON: 'brick',
  DUATHLON: 'brick',
  BIATHLON: 'brick',

  // Strength
  STRENGTH_TRAINING: 'strength',
  CARDIO_TRAINING: 'strength',
  CIRCUIT_TRAINING: 'strength',
  HIIT: 'strength',

  // Recovery / other
  YOGA: 'recovery',
  PILATES: 'recovery',
  STRETCHING: 'recovery',
  MEDITATION: 'recovery',
  WALKING: 'recovery',
  HIKING: 'recovery',
}

/**
 * Maps a Garmin activityType string to our discipline enum value.
 * Unknown types fall back to 'run' (most common; caller can override).
 */
export function mapGarminSportType(activityType: string): Discipline {
  const normalised = activityType.toUpperCase().replace(/\s+/g, '_')
  return GARMIN_SPORT_MAP[normalised] ?? 'run'
}

// ── Pace helpers ───────────────────────────────────────────────────────────────

/**
 * Convert m/s to sec/100m (for swimming).
 * Returns undefined if speed is zero or missing.
 */
function mpsToSecPer100m(mps: number | undefined): number | undefined {
  if (!mps || mps <= 0) return undefined
  return Math.round(100 / mps)
}

/**
 * Convert m/s to sec/km (for running).
 * Returns undefined if speed is zero or missing.
 */
function mpsToSecPerKm(mps: number | undefined): number | undefined {
  if (!mps || mps <= 0) return undefined
  return Math.round(1000 / mps)
}

// ── Parsed output type ─────────────────────────────────────────────────────────

export interface ParsedActivity {
  /** Garmin provider user ID — used to look up our internal userId */
  garminUserId: string
  garminSummaryId: string
  garminActivityId: number | undefined
  activityName: string | undefined
  discipline: Discipline
  /** ISO-8601 date string (local date at the activity start) */
  date: string
  /** Unix timestamp of activity start */
  startTimestamp: number
  durationMinutes: number
  actualData: {
    durationSeconds: number
    distanceMeters?: number
    avgHr?: number
    maxHr?: number
    avgPowerWatts?: number
    normalizedPowerWatts?: number
    avgPaceSecPer100m?: number
    avgPaceSecPerKm?: number
    tss?: number
    elevationGainM?: number
    calories?: number
  }
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parses a single Garmin activitySummary into our internal shape.
 */
export function parseActivity(summary: GarminActivitySummary): ParsedActivity {
  const discipline = mapGarminSportType(summary.activityType)

  // Derive local date from epoch + offset
  const offsetSec = summary.startTimeOffsetInSeconds ?? 0
  const localMs = (summary.startTimeInSeconds + offsetSec) * 1000
  const date = new Date(localMs).toISOString().slice(0, 10)

  const durationMinutes = Math.round(summary.durationInSeconds / 60)

  // Build pace fields based on discipline
  const avgPaceSecPer100m =
    discipline === 'swim' ? mpsToSecPer100m(summary.averageSpeedInMetersPerSecond) : undefined
  const avgPaceSecPerKm =
    discipline === 'run' ? mpsToSecPerKm(summary.averageSpeedInMetersPerSecond) : undefined

  const actualData: ParsedActivity['actualData'] = {
    durationSeconds: summary.durationInSeconds,
  }
  if (summary.distanceInMeters !== undefined) actualData.distanceMeters = summary.distanceInMeters
  if (summary.averageHeartRateInBeatsPerMinute !== undefined)
    actualData.avgHr = summary.averageHeartRateInBeatsPerMinute
  if (summary.maxHeartRateInBeatsPerMinute !== undefined)
    actualData.maxHr = summary.maxHeartRateInBeatsPerMinute
  if (summary.averagePowerInWatts !== undefined && summary.averagePowerInWatts > 0)
    actualData.avgPowerWatts = summary.averagePowerInWatts
  if (summary.normalizedPowerInWatts !== undefined && summary.normalizedPowerInWatts > 0)
    actualData.normalizedPowerWatts = summary.normalizedPowerInWatts
  if (avgPaceSecPer100m !== undefined) actualData.avgPaceSecPer100m = avgPaceSecPer100m
  if (avgPaceSecPerKm !== undefined) actualData.avgPaceSecPerKm = avgPaceSecPerKm
  if (summary.trainingStressScore !== undefined) actualData.tss = summary.trainingStressScore
  if (summary.totalElevationGainInMeters !== undefined)
    actualData.elevationGainM = summary.totalElevationGainInMeters
  if (summary.calories !== undefined) actualData.calories = summary.calories

  return {
    garminUserId: summary.userId,
    garminSummaryId: summary.summaryId,
    garminActivityId: summary.activityId,
    activityName: summary.activityName,
    discipline,
    date,
    startTimestamp: summary.startTimeInSeconds,
    durationMinutes,
    actualData,
  }
}

/**
 * Parses all activitySummaries from a webhook payload.
 */
export function parseActivityWebhookPayload(
  payload: GarminActivityWebhookPayload
): ParsedActivity[] {
  return (payload.activitySummaries ?? []).map(parseActivity)
}
