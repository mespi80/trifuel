/**
 * Wahoo activity parser.
 *
 * Normalizes Wahoo workout objects (from GET /v1/workouts) into the
 * common `TrainingSessionActual` shape. Pure — no DB calls.
 */

import type { TrainingSessionActual, Discipline } from '@/services/wearables/types'

// ── Wahoo API types ────────────────────────────────────────────────────────────

export interface WahooWorkoutSummary {
  id?: number
  workout_id?: number
  duration_active_accum?: number // seconds
  duration_paused_accum?: number
  distance_accum?: number // metres
  ascent_accum?: number // metres
  hr_avg?: number // bpm
  hr_max?: number
  power_avg?: number // watts
  power_bike_np_last?: number // normalized power (watts)
  calories_accum?: number
  tss_last?: number // Training Stress Score
}

export interface WahooWorkout {
  id: number
  name?: string
  workout_type_id: number
  starts?: string // ISO 8601 string
  minutes?: number
  plan_date?: string // "YYYY-MM-DD"
  workout_summary?: WahooWorkoutSummary
}

export interface WahooWorkoutsResponse {
  workouts?: {
    items?: WahooWorkout[]
    total?: number
    page?: number
    per_page?: number
  }
}

// ── Sport type mapping ─────────────────────────────────────────────────────────

/**
 * Wahoo workout_type_id → our Discipline.
 * IDs sourced from the Wahoo developer documentation.
 */
const WAHOO_SPORT_MAP: Record<number, Discipline> = {
  1: 'bike', // Cycling
  2: 'bike', // Indoor Cycling / Trainer
  3: 'run', // Running
  4: 'run', // Treadmill Running
  5: 'swim', // Swimming
  6: 'swim', // Pool Swimming
  7: 'strength', // Gym / Strength
  8: 'strength', // Core Training
  9: 'recovery', // Walking
  10: 'recovery', // Hiking
  11: 'bike', // Mountain Biking
  12: 'run', // Trail Running
  13: 'brick', // Duathlon / Multisport
  14: 'brick', // Triathlon
  25: 'strength', // Yoga
  26: 'recovery', // Stretching
  // Wahoo SYSTM workout types
  91: 'bike',
  92: 'run',
}

export function mapWahooSportType(workoutTypeId: number): Discipline {
  return WAHOO_SPORT_MAP[workoutTypeId] ?? 'run'
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parses a single Wahoo workout into our common shape.
 */
export function parseWahooWorkout(workout: WahooWorkout, userId: string): TrainingSessionActual {
  const discipline = mapWahooSportType(workout.workout_type_id)

  // Determine date and timestamp from `starts` or `plan_date`
  const startsStr = workout.starts ?? workout.plan_date
  const startDate = startsStr ? new Date(startsStr) : new Date()
  const date = startDate.toISOString().slice(0, 10)
  const startTimestamp = Math.floor(startDate.getTime() / 1000)

  const durationMinutes = workout.minutes ?? 0
  const summary = workout.workout_summary

  const data: TrainingSessionActual['data'] = {
    durationSeconds: summary?.duration_active_accum ?? durationMinutes * 60,
  }

  if (summary?.distance_accum !== undefined && summary.distance_accum > 0)
    data.distanceMeters = summary.distance_accum
  if (summary?.hr_avg !== undefined && summary.hr_avg > 0) data.avgHr = summary.hr_avg
  if (summary?.hr_max !== undefined && summary.hr_max > 0) data.maxHr = summary.hr_max
  if (summary?.power_avg !== undefined && summary.power_avg > 0)
    data.avgPowerWatts = summary.power_avg
  if (summary?.power_bike_np_last !== undefined && summary.power_bike_np_last > 0)
    data.normalizedPowerWatts = summary.power_bike_np_last
  if (summary?.tss_last !== undefined && summary.tss_last > 0) data.tss = summary.tss_last
  if (summary?.ascent_accum !== undefined && summary.ascent_accum > 0)
    data.elevationGainM = summary.ascent_accum
  if (summary?.calories_accum !== undefined && summary.calories_accum > 0)
    data.calories = summary.calories_accum

  // Derive pace for run (from duration + distance)
  if (discipline === 'run' && data.distanceMeters && data.durationSeconds > 0) {
    const mps = data.distanceMeters / data.durationSeconds
    if (mps > 0) data.avgPaceSecPerKm = Math.round(1000 / mps)
  }

  // Derive pace for swim
  if (discipline === 'swim' && data.distanceMeters && data.durationSeconds > 0) {
    const mps = data.distanceMeters / data.durationSeconds
    if (mps > 0) data.avgPaceSecPer100m = Math.round(100 / mps)
  }

  return {
    userId,
    provider: 'wahoo',
    providerActivityId: String(workout.id),
    activityName: workout.name,
    discipline,
    date,
    startTimestamp,
    durationMinutes,
    data,
  }
}

/**
 * Parses a Wahoo workouts API response into a list of normalized activities.
 */
export function parseWahooWorkoutsResponse(
  response: WahooWorkoutsResponse,
  userId: string
): TrainingSessionActual[] {
  const items = response.workouts?.items ?? []
  return items.map((w) => parseWahooWorkout(w, userId))
}
