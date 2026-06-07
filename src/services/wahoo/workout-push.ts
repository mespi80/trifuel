/**
 * Serialize a planned session into Wahoo's planned workout format
 * and push to POST /v1/planned_workouts.
 *
 * Wahoo's planned_workouts API accepts a JSON payload with a workout_type_id,
 * name, plan_date, and an optional workout_token (WIF / FIT file as base64).
 * For simplicity we push without a workout_token; the workout appears as a
 * simple duration + type target in the ELEMNT/Bolt companion app.
 */

import { wahoo } from './client'
import type { SessionToSerialize, Discipline } from '@/services/wearables/types'

// ── Wahoo workout type IDs ─────────────────────────────────────────────────────

const DISCIPLINE_TO_WAHOO_TYPE: Record<Discipline, number> = {
  bike: 1,
  run: 3,
  swim: 5,
  brick: 14, // Triathlon
  strength: 7,
  recovery: 9, // Walking / recovery
}

// ── Wahoo planned workout payload ──────────────────────────────────────────────

interface WahooPlannedWorkout {
  workout_type_id: number
  name: string
  plan_date: string // "YYYY-MM-DD"
  minutes?: number
  workout_summary?: {
    duration_active_accum?: number // seconds
  }
}

interface WahooPlannedWorkoutResponse {
  id: number
  name: string
  plan_date: string
}

// ── Serialiser ─────────────────────────────────────────────────────────────────

export function serializeWahooWorkout(
  session: SessionToSerialize,
  name: string,
  planDate: string // "YYYY-MM-DD"
): WahooPlannedWorkout {
  return {
    workout_type_id: DISCIPLINE_TO_WAHOO_TYPE[session.discipline] ?? 1,
    name,
    plan_date: planDate,
    minutes: session.durationMinutes,
    workout_summary: {
      duration_active_accum: session.durationMinutes * 60,
    },
  }
}

// ── API push ───────────────────────────────────────────────────────────────────

/**
 * Pushes a planned workout to Wahoo. Returns the created workout ID.
 *
 * @param planDate "YYYY-MM-DD" — the scheduled date on the device
 */
export async function pushWorkoutToWahoo(
  userId: string,
  session: SessionToSerialize,
  name: string,
  planDate: string
): Promise<string> {
  const payload = serializeWahooWorkout(session, name, planDate)
  const response = await wahoo.post<WahooPlannedWorkoutResponse>(userId, '/v1/planned_workouts', {
    planned_workout: payload,
  })
  return String(response.id)
}
