/**
 * Serialize a planned TrainingSession into Garmin's workout JSON format
 * and push it via the Health API so it appears on the user's connected device.
 *
 * Garmin accepts workout creation via POST /workout-service/workouts (JSON).
 * The device downloads workouts on next sync.
 *
 * Reference: Garmin Health API – Workout Push documentation.
 */

import { garmin } from './client'

// ── Garmin workout types ───────────────────────────────────────────────────────

type GarminSportType =
  | 'RUNNING'
  | 'CYCLING'
  | 'SWIMMING'
  | 'STRENGTH_TRAINING'
  | 'CARDIO_TRAINING'
  | 'OTHER'

type GarminStepType = 'WARMUP' | 'COOLDOWN' | 'INTERVAL' | 'RECOVERY' | 'REST' | 'REPEAT'

type GarminDurationType =
  | 'TIME'
  | 'DISTANCE'
  | 'HR_LESS_THAN'
  | 'HR_GREATER_THAN'
  | 'CALORIES'
  | 'OPEN'
  | 'REPEAT_UNTIL_STEPS_CRIT'

type GarminTargetType = 'NO_TARGET' | 'POWER' | 'HEART_RATE' | 'CADENCE' | 'PACE'

interface GarminWorkoutStep {
  type: 'WorkoutStep'
  stepId: number
  stepName?: string
  stepType: GarminStepType
  durationType: GarminDurationType
  durationValue?: number // seconds for TIME, metres for DISTANCE
  targetType: GarminTargetType
  targetValueLow?: number
  targetValueHigh?: number
  description?: string
}

interface GarminRepeatStep {
  type: 'WorkoutRepeatStep'
  stepId: number
  stepType: 'REPEAT'
  repeatType: 'REPEAT_UNTIL_STEPS_CRIT'
  repeatValue: number // number of repetitions
  steps: GarminWorkoutStep[]
}

type GarminStep = GarminWorkoutStep | GarminRepeatStep

interface GarminWorkout {
  workoutName: string
  description?: string
  sportType: { sportTypeId: number; sportTypeKey: GarminSportType }
  estimatedDurationInSecs: number
  workoutSegments: Array<{
    segmentOrder: number
    sportType: { sportTypeId: number; sportTypeKey: GarminSportType }
    workoutSteps: GarminStep[]
  }>
}

interface GarminWorkoutResponse {
  workoutId: number
  workoutName: string
}

// ── Sport type map ─────────────────────────────────────────────────────────────

type Discipline = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'recovery'

const SPORT_TYPE_MAP: Record<Discipline, { sportTypeId: number; sportTypeKey: GarminSportType }> = {
  run: { sportTypeId: 1, sportTypeKey: 'RUNNING' },
  bike: { sportTypeId: 2, sportTypeKey: 'CYCLING' },
  swim: { sportTypeId: 5, sportTypeKey: 'SWIMMING' },
  brick: { sportTypeId: 1, sportTypeKey: 'RUNNING' }, // brick uses run as primary
  strength: { sportTypeId: 20, sportTypeKey: 'STRENGTH_TRAINING' },
  recovery: { sportTypeId: 26, sportTypeKey: 'OTHER' },
}

// ── Input types ────────────────────────────────────────────────────────────────

export interface WorkoutInterval {
  reps?: number
  distance?: number // metres
  durationSeconds?: number
  restSeconds?: number
  targetPace?: string // e.g. "4:30/km" or "1:45/100m"
  targetPower?: number // watts
  targetHr?: number // bpm
}

export interface SessionToSerialize {
  discipline: Discipline
  durationMinutes: number
  intensityZone?: string // "z1" – "z6"
  objective?: string
  intervals?: WorkoutInterval[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let stepCounter = 0

function nextStepId(): number {
  return ++stepCounter
}

function resetStepCounter(): void {
  stepCounter = 0
}

/** Convert "4:30/km" pace string to m/s speed (for pace target) */
function paceStringToMps(pace: string): { low: number; high: number } | undefined {
  // Accepts "M:SS/km" or "M:SS/100m"
  const kmMatch = pace.match(/^(\d+):(\d{2})\/km$/)
  const swimMatch = pace.match(/^(\d+):(\d{2})\/100m$/)

  if (kmMatch) {
    const secPerKm = parseInt(kmMatch[1]!) * 60 + parseInt(kmMatch[2]!)
    const mps = 1000 / secPerKm
    return { low: mps * 0.95, high: mps * 1.05 }
  }
  if (swimMatch) {
    const secPer100m = parseInt(swimMatch[1]!) * 60 + parseInt(swimMatch[2]!)
    const mps = 100 / secPer100m
    return { low: mps * 0.95, high: mps * 1.05 }
  }
  return undefined
}

/** Build target fields for a step based on available info */
function buildTarget(
  interval: WorkoutInterval,
  _zone?: string
): Pick<GarminWorkoutStep, 'targetType' | 'targetValueLow' | 'targetValueHigh'> {
  // Power target takes priority
  if (interval.targetPower) {
    return {
      targetType: 'POWER',
      targetValueLow: Math.round(interval.targetPower * 0.95),
      targetValueHigh: Math.round(interval.targetPower * 1.05),
    }
  }
  // HR target
  if (interval.targetHr) {
    return {
      targetType: 'HEART_RATE',
      targetValueLow: Math.round(interval.targetHr * 0.97),
      targetValueHigh: Math.round(interval.targetHr * 1.03),
    }
  }
  // Pace target
  if (interval.targetPace) {
    const speed = paceStringToMps(interval.targetPace)
    if (speed) {
      return {
        targetType: 'PACE',
        targetValueLow: Math.round(speed.low * 1000) / 1000,
        targetValueHigh: Math.round(speed.high * 1000) / 1000,
      }
    }
  }
  return { targetType: 'NO_TARGET' }
}

/** Build a simple timed step (warm-up, cool-down, or steady-state) */
function buildTimedStep(
  stepType: GarminStepType,
  durationSeconds: number,
  targetOpts: Pick<GarminWorkoutStep, 'targetType' | 'targetValueLow' | 'targetValueHigh'>
): GarminWorkoutStep {
  return {
    type: 'WorkoutStep',
    stepId: nextStepId(),
    stepType,
    durationType: 'TIME',
    durationValue: durationSeconds,
    ...targetOpts,
  }
}

/** Build a distance-based step */
function buildDistanceStep(
  stepType: GarminStepType,
  distanceMetres: number,
  targetOpts: Pick<GarminWorkoutStep, 'targetType' | 'targetValueLow' | 'targetValueHigh'>
): GarminWorkoutStep {
  return {
    type: 'WorkoutStep',
    stepId: nextStepId(),
    stepType,
    durationType: 'DISTANCE',
    durationValue: distanceMetres,
    ...targetOpts,
  }
}

/** Build repeat block: N × (work + optional rest) */
function buildRepeatBlock(interval: WorkoutInterval): GarminRepeatStep {
  const reps = interval.reps ?? 1
  const target = buildTarget(interval)
  const innerSteps: GarminWorkoutStep[] = []

  // Work step — prefer distance, fall back to time
  if (interval.distance) {
    innerSteps.push(buildDistanceStep('INTERVAL', interval.distance, target))
  } else if (interval.durationSeconds) {
    innerSteps.push(buildTimedStep('INTERVAL', interval.durationSeconds, target))
  }

  // Rest step
  if (interval.restSeconds && interval.restSeconds > 0) {
    innerSteps.push(buildTimedStep('REST', interval.restSeconds, { targetType: 'NO_TARGET' }))
  }

  return {
    type: 'WorkoutRepeatStep',
    stepId: nextStepId(),
    stepType: 'REPEAT',
    repeatType: 'REPEAT_UNTIL_STEPS_CRIT',
    repeatValue: reps,
    steps: innerSteps,
  }
}

// ── Zone intensity → approximate HR / power fractions ─────────────────────────

const ZONE_HR_PCT: Record<string, [number, number]> = {
  z1: [0.5, 0.6],
  z2: [0.6, 0.7],
  z3: [0.7, 0.8],
  z4: [0.8, 0.9],
  z5: [0.9, 0.97],
  z6: [0.97, 1.0],
}

/** Steady-state zone step for sessions without defined intervals */
function buildZoneStep(
  discipline: Discipline,
  durationSeconds: number,
  zone: string
): GarminWorkoutStep {
  const pcts = ZONE_HR_PCT[zone] ?? ZONE_HR_PCT['z2']!
  const sportType = SPORT_TYPE_MAP[discipline].sportTypeKey
  const stepType: GarminStepType =
    pcts[0]! < 0.7 ? 'WARMUP' : pcts[0]! >= 0.9 ? 'INTERVAL' : 'INTERVAL'
  void sportType // sport type not needed on the step itself

  return {
    type: 'WorkoutStep',
    stepId: nextStepId(),
    stepType,
    durationType: 'TIME',
    durationValue: durationSeconds,
    targetType: 'HEART_RATE',
    targetValueLow: Math.round(200 * pcts[0]!), // rough estimate; device uses user's maxHR
    targetValueHigh: Math.round(200 * pcts[1]!),
  }
}

// ── Main serialiser ────────────────────────────────────────────────────────────

/**
 * Converts our internal session format into a Garmin workout payload.
 */
export function serializeWorkout(session: SessionToSerialize, workoutName: string): GarminWorkout {
  resetStepCounter()

  const sportType = SPORT_TYPE_MAP[session.discipline]
  const totalDurationSec = session.durationMinutes * 60
  const warmupSec = Math.min(600, Math.round(totalDurationSec * 0.1)) // 10%, max 10min
  const cooldownSec = warmupSec
  const mainSec = totalDurationSec - warmupSec - cooldownSec

  const steps: GarminStep[] = []

  // Warm-up
  steps.push(buildTimedStep('WARMUP', warmupSec, { targetType: 'NO_TARGET' }))

  // Main block — either intervals or steady-state
  if (session.intervals && session.intervals.length > 0) {
    for (const interval of session.intervals) {
      steps.push(buildRepeatBlock(interval))
    }
  } else {
    // Steady-state for the zone
    const zone = session.intensityZone ?? 'z2'
    steps.push(buildZoneStep(session.discipline, mainSec, zone))
  }

  // Cool-down
  steps.push(buildTimedStep('COOLDOWN', cooldownSec, { targetType: 'NO_TARGET' }))

  return {
    workoutName,
    description: session.objective,
    sportType,
    estimatedDurationInSecs: totalDurationSec,
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType,
        workoutSteps: steps,
      },
    ],
  }
}

// ── API call ───────────────────────────────────────────────────────────────────

/**
 * Pushes a serialized workout to Garmin for the given user.
 * Returns the created workout ID from Garmin.
 */
export async function pushWorkoutToGarmin(
  userId: string,
  session: SessionToSerialize,
  workoutName: string
): Promise<number> {
  const payload = serializeWorkout(session, workoutName)
  const response = await garmin.post<GarminWorkoutResponse>(
    userId,
    '/workout-service/workouts',
    payload
  )
  return response.workoutId
}
