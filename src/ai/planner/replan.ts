/**
 * Adaptive replanning engine.
 *
 * Handles four trigger types that require modifying the current training plan:
 *
 *   MISSED_SESSION
 *     Classify the session as key (threshold/long-ride/brick/VO₂max) or
 *     secondary (easy recovery, technique swim, short run).
 *     • Key session  → attempt to reschedule in the same or next week.
 *     • Secondary    → absorb; do not reschedule.
 *
 *   FATIGUE_SIGNAL
 *     Triggered by RPE ≥ 7 averaged over ≥ 3 recent sessions, or HRV
 *     dropping > 10 % from the athlete's rolling baseline.
 *     • Reduce next week's target volume by 15–20 %.
 *     • Shift intensity distribution one step toward lower zones.
 *     • Mark the week as a forced recovery week.
 *
 *   AVAILABILITY_CHANGE
 *     One or more days the athlete planned to train are now unavailable.
 *     • Identify which planned sessions fall on removed days.
 *     • Classify each as key or secondary.
 *     • Try to fit key sessions on remaining available days,
 *       respecting the ≤ 2 hard sessions / day cap and no back-to-back
 *       same-discipline hard-session rule.
 *     • Secondary sessions that cannot be fitted are dropped.
 *
 *   OVERPERFORMANCE
 *     If the last N completed sessions (configurable; default 3) all
 *     exceeded their planned zone or duration by the overperformance
 *     threshold (default: zone +1 or duration ≥ 110 %), nudge the next
 *     micro-cycle upward:
 *     • Increase target hours by OVERPERFORMANCE_VOLUME_BUMP (default 5 %).
 *     • Shift one hard session's primary zone up by one step.
 *     • Never exceed absolute ceilings (zone z5, hours × 1.10).
 *
 * All handlers return a `ReplanResult` containing:
 *   • The updated 7–14 day schedule (array of `ScheduledDay`).
 *   • A human-readable explanation in EN and ES.
 *   • A list of changes made (for audit / display).
 *   • The trigger that caused the replan.
 */

import type {
  PhaseLabel,
  ExperienceLevel,
  RaceDistance,
  ZoneDistribution,
  DisciplineSplit,
} from './types'
import type {
  GeneratedSession,
  DayKey,
  ZoneKey,
  WeekSessionInput,
  BilingualText,
} from './session-generator'
import { generateWeekSessions, findBackToBackHardViolation } from './session-generator'
import { normalise } from './intensity'

// ── Enumerations ───────────────────────────────────────────────────────────────

export type TriggerType =
  | 'missed_session'
  | 'fatigue_signal'
  | 'availability_change'
  | 'overperformance'

export type SessionPriority = 'key' | 'secondary'

// ── Trigger payloads ───────────────────────────────────────────────────────────

export interface MissedSessionTrigger {
  type: 'missed_session'
  /** The session that was not completed. */
  session: GeneratedSession
  /** ISO-8601 date the session was scheduled for. */
  scheduledDate: string
}

export interface FatigueSignalTrigger {
  type: 'fatigue_signal'
  /** RPE values from recent completed sessions (most recent last). */
  recentRpe: number[]
  /** Athlete's rolling HRV baseline (ms). */
  hrvBaseline?: number
  /** Most recent HRV measurement (ms). */
  currentHrv?: number
}

export interface AvailabilityChangeTrigger {
  type: 'availability_change'
  /** Days that are no longer available this week. */
  removedDays: DayKey[]
  /** Days that remain available (after removal). */
  remainingDays: DayKey[]
  /** The sessions that were planned for the current week. */
  plannedSessions: GeneratedSession[]
}

export interface OverperformanceTrigger {
  type: 'overperformance'
  /** Completed session data from recent sessions. */
  completedSessions: CompletedSession[]
}

export type ReplanTrigger =
  | MissedSessionTrigger
  | FatigueSignalTrigger
  | AvailabilityChangeTrigger
  | OverperformanceTrigger

// ── Athlete context (passed to all replan functions) ───────────────────────────

export interface AthleteContext {
  experienceLevel: ExperienceLevel
  raceDistance: RaceDistance
  phase: PhaseLabel
  /** The week's planned discipline split. */
  disciplineSplit: DisciplineSplit
  /** The week's planned intensity distribution. */
  intensityDistribution: ZoneDistribution
  /** Target weekly hours for the current week (before replan). */
  weeklyHours: number
  /** Available days for the current week. */
  availableDays: DayKey[]
  /** The complete planned sessions for the current week. */
  currentWeekSessions: GeneratedSession[]
  /** Target weekly hours for the following week (before replan). */
  nextWeekHours?: number
  /** Available days for the following week. */
  nextWeekAvailableDays?: DayKey[]
  /** Planned sessions for the following week (if already generated). */
  nextWeekSessions?: GeneratedSession[]
  /** ISO date of the Monday of the current week. */
  weekStartDate: string
}

// ── Completed session (for overperformance detection) ─────────────────────────

export interface CompletedSession {
  planned: GeneratedSession
  /** Actual duration completed (minutes). */
  actualDurationMinutes: number
  /**
   * Actual primary zone achieved.  'z5' > 'z4' > 'z3' > 'z2' > 'z1'.
   */
  actualPrimaryZone: ZoneKey
  /** Athlete's self-reported RPE (1–10). */
  rpe?: number
}

// ── Replan output ──────────────────────────────────────────────────────────────

export interface ReplanChange {
  kind:
    | 'session_rescheduled'
    | 'session_absorbed'
    | 'session_dropped'
    | 'volume_reduced'
    | 'volume_increased'
    | 'intensity_shifted_down'
    | 'intensity_shifted_up'
    | 'week_marked_recovery'
    | 'session_moved'
    | 'hard_cap_applied'
  description: BilingualText
}

export interface ScheduledDay {
  day: DayKey
  /** ISO-8601 date. */
  date: string
  session: GeneratedSession
}

export interface ReplanResult {
  trigger: TriggerType
  /** Updated 7–14 day schedule (current week + optional next week). */
  schedule: ScheduledDay[]
  /** Updated target hours for current week. */
  updatedWeeklyHours: number
  /** Updated intensity distribution for current week. */
  updatedIntensityDistribution: ZoneDistribution
  /** Whether the week was marked as a forced recovery week. */
  isForcedRecoveryWeek: boolean
  /** List of changes applied. */
  changes: ReplanChange[]
  /** Human-readable explanation. */
  explanation: BilingualText
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_INDEX: Record<DayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
}

/** Minimum average RPE (over ≥ 3 sessions) that triggers fatigue reduction. */
const FATIGUE_RPE_THRESHOLD = 7.0
/** Minimum number of recent sessions whose RPE must be ≥ threshold. */
const FATIGUE_RPE_MIN_SESSIONS = 3
/** HRV drop fraction that triggers fatigue reduction. */
const FATIGUE_HRV_DROP_FRACTION = 0.1
/** Volume reduction factor when fatigue is detected. */
const FATIGUE_VOLUME_REDUCTION_LOW = 0.85 // -15 %
const FATIGUE_VOLUME_REDUCTION_HIGH = 0.8 // -20 %
/** Maximum hard sessions per day in an availability-change replan. */
const MAX_HARD_PER_DAY = 2
/** Duration ratio above which a session is overperformance. */
const OVERPERFORMANCE_DURATION_RATIO = 1.1
/** Volume bump fraction for overperformance. */
const OVERPERFORMANCE_VOLUME_BUMP = 0.05
/** Max absolute volume multiplier (vs original weeklyHours). */
const OVERPERFORMANCE_VOLUME_CAP = 1.1
/** Minimum sessions to confirm overperformance. */
const OVERPERFORMANCE_MIN_SESSIONS = 3

// ── Zone ordering ──────────────────────────────────────────────────────────────

const ZONE_RANK: Record<ZoneKey, number> = { z1: 0, z2: 1, z3: 2, z4: 3, z5: 4 }

function zoneRank(z: ZoneKey): number {
  return ZONE_RANK[z]
}

// ── Session classification ─────────────────────────────────────────────────────

/**
 * Classify a session as key (threshold/long-ride/brick/VO₂max) or secondary.
 *
 * Key sessions are high-value stimuli that, if missed, meaningfully set back
 * the training block.  Secondary sessions contribute volume or recovery and
 * can be absorbed without significant consequence.
 */
export function classifySession(session: GeneratedSession): SessionPriority {
  const { discipline, isHardSession, isBrick, durationMinutes, primaryZone } = session

  // Rest and active recovery are never "key"
  if (discipline === 'rest' || discipline === 'active_recovery') return 'secondary'

  // Brick sessions are always key
  if (isBrick) return 'key'

  // Hard sessions with meaningful intensity are key
  if (isHardSession && (primaryZone === 'z4' || primaryZone === 'z5')) return 'key'

  // Long rides > 90 min are key aerobic stimuli
  if (discipline === 'bike' && durationMinutes >= 90) return 'key'

  // Long runs > 60 min are key
  if (discipline === 'run' && durationMinutes >= 60) return 'key'

  return 'secondary'
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

/**
 * Build a map from DayKey → ISO date string for a week starting on `mondayIso`.
 */
function weekDates(mondayIso: string): Record<DayKey, string> {
  const result = {} as Record<DayKey, string>
  DAY_ORDER.forEach((day, i) => {
    result[day] = addDays(mondayIso, i)
  })
  return result
}

// ── Intensity shift helpers ────────────────────────────────────────────────────

/**
 * Shift an intensity distribution one step downward (toward easy zones).
 * Transfers SHIFT_AMOUNT from Z4+Z5 into Z1.
 */
export function shiftIntensityDown(dist: ZoneDistribution, amount = 0.05): ZoneDistribution {
  const z4cut = Math.min(dist.z4, amount / 2)
  const z5cut = Math.min(dist.z5, amount / 2)
  const freed = z4cut + z5cut
  return normalise({
    z1: dist.z1 + freed,
    z2: dist.z2,
    z3: dist.z3,
    z4: dist.z4 - z4cut,
    z5: dist.z5 - z5cut,
  })
}

/**
 * Shift an intensity distribution one step upward (toward hard zones).
 * Transfers SHIFT_AMOUNT from Z1 into Z4.
 */
export function shiftIntensityUp(dist: ZoneDistribution, amount = 0.03): ZoneDistribution {
  const z1cut = Math.min(dist.z1, amount)
  return normalise({
    z1: dist.z1 - z1cut,
    z2: dist.z2,
    z3: dist.z3,
    z4: dist.z4 + z1cut,
    z5: dist.z5,
  })
}

// ── Schedule builder ───────────────────────────────────────────────────────────

function buildSchedule(sessions: GeneratedSession[], weekStartDate: string): ScheduledDay[] {
  const dates = weekDates(weekStartDate)
  return sessions
    .filter((s) => DAY_ORDER.includes(s.day))
    .sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day])
    .map((s) => ({ day: s.day, date: dates[s.day], session: s }))
}

function buildTwoWeekSchedule(
  currentSessions: GeneratedSession[],
  nextSessions: GeneratedSession[],
  weekStartDate: string
): ScheduledDay[] {
  const nextMonday = addDays(weekStartDate, 7)
  return [
    ...buildSchedule(currentSessions, weekStartDate),
    ...buildSchedule(nextSessions, nextMonday),
  ]
}

// ── Trigger: MISSED SESSION ───────────────────────────────────────────────────

/**
 * Handle a missed session.
 *
 * Algorithm:
 *  1. Classify the session.
 *  2. If secondary → absorb (no change to schedule).
 *  3. If key → find the earliest available slot this week or next week
 *     that does not create a back-to-back hard-session conflict.
 *  4. If no slot can be found, absorb with a note.
 */
export function handleMissedSession(
  trigger: MissedSessionTrigger,
  ctx: AthleteContext
): ReplanResult {
  const missed = trigger.session
  const priority = classifySession(missed)
  const changes: ReplanChange[] = []

  // Current week sessions without the missed one
  const currentSessions = ctx.currentWeekSessions.filter(
    (s) => !(s.day === missed.day && s.discipline === missed.discipline)
  )

  if (priority === 'secondary') {
    changes.push({
      kind: 'session_absorbed',
      description: {
        en: `Missed ${missed.discipline} session (${missed.day}) was secondary — absorbed, no reschedule needed`,
        es: `La sesión de ${missed.discipline} omitida (${missed.day}) era secundaria — absorbida, no se necesita reagendar`,
      },
    })

    return {
      trigger: 'missed_session',
      schedule: buildSchedule(currentSessions, ctx.weekStartDate),
      updatedWeeklyHours: ctx.weeklyHours,
      updatedIntensityDistribution: ctx.intensityDistribution,
      isForcedRecoveryWeek: false,
      changes,
      explanation: {
        en: `The missed ${missed.discipline} session was a secondary (easy/recovery) workout. No rescheduling is needed — continue with the remaining plan.`,
        es: `La sesión de ${missed.discipline} omitida era un entrenamiento secundario (suave/recuperación). No se necesita reagendar — continúa con el plan restante.`,
      },
    }
  }

  // Key session — attempt to reschedule
  // Try later days this week first
  const missedDayIdx = DAY_INDEX[missed.day]
  const currentWeekSlots = ctx.availableDays
    .filter((d) => DAY_INDEX[d] > missedDayIdx)
    .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])

  const rescheduleDay = findValidRescheduleDay(missed, currentSessions, currentWeekSlots)

  if (rescheduleDay) {
    const rescheduled: GeneratedSession = {
      ...missed,
      day: rescheduleDay,
      dayIndex: DAY_INDEX[rescheduleDay],
    }
    currentSessions.push(rescheduled)

    changes.push({
      kind: 'session_rescheduled',
      description: {
        en: `Key ${missed.discipline} session moved from ${missed.day} to ${rescheduleDay} (same week)`,
        es: `Sesión clave de ${missed.discipline} movida de ${missed.day} a ${rescheduleDay} (misma semana)`,
      },
    })

    return {
      trigger: 'missed_session',
      schedule: buildSchedule(currentSessions, ctx.weekStartDate),
      updatedWeeklyHours: ctx.weeklyHours,
      updatedIntensityDistribution: ctx.intensityDistribution,
      isForcedRecoveryWeek: false,
      changes,
      explanation: {
        en: `The missed ${missed.discipline} session was a key workout. It has been rescheduled to ${rescheduleDay} of this week.`,
        es: `La sesión de ${missed.discipline} omitida era un entrenamiento clave. Ha sido reagendada al ${rescheduleDay} de esta semana.`,
      },
    }
  }

  // Try next week
  if (ctx.nextWeekSessions && ctx.nextWeekAvailableDays) {
    const nextSessions = [...ctx.nextWeekSessions]
    const nextSlots = ctx.nextWeekAvailableDays.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
    const nextDay = findValidRescheduleDay(missed, nextSessions, nextSlots)

    if (nextDay) {
      const rescheduled: GeneratedSession = {
        ...missed,
        day: nextDay,
        dayIndex: DAY_INDEX[nextDay],
      }
      nextSessions.push(rescheduled)

      changes.push({
        kind: 'session_rescheduled',
        description: {
          en: `Key ${missed.discipline} session rescheduled to ${nextDay} of next week`,
          es: `Sesión clave de ${missed.discipline} reagendada al ${nextDay} de la próxima semana`,
        },
      })

      return {
        trigger: 'missed_session',
        schedule: buildTwoWeekSchedule(currentSessions, nextSessions, ctx.weekStartDate),
        updatedWeeklyHours: ctx.weeklyHours,
        updatedIntensityDistribution: ctx.intensityDistribution,
        isForcedRecoveryWeek: false,
        changes,
        explanation: {
          en: `The missed ${missed.discipline} session (key workout) has been rescheduled to ${nextDay} next week as no space was available this week.`,
          es: `La sesión clave de ${missed.discipline} omitida ha sido reagendada al ${nextDay} de la próxima semana ya que no había espacio esta semana.`,
        },
      }
    }
  }

  // No slot available — absorb
  changes.push({
    kind: 'session_absorbed',
    description: {
      en: `Key ${missed.discipline} session could not be rescheduled — absorbed. Consider adding an extra session next week`,
      es: `La sesión clave de ${missed.discipline} no pudo reagendarse — absorbida. Considera agregar una sesión extra la próxima semana`,
    },
  })

  return {
    trigger: 'missed_session',
    schedule: buildSchedule(currentSessions, ctx.weekStartDate),
    updatedWeeklyHours: ctx.weeklyHours,
    updatedIntensityDistribution: ctx.intensityDistribution,
    isForcedRecoveryWeek: false,
    changes,
    explanation: {
      en: `The missed ${missed.discipline} session was a key workout, but no suitable slot was found in this week or next. The session has been absorbed — stay consistent with the remaining plan.`,
      es: `La sesión clave de ${missed.discipline} omitida no tiene espacio disponible esta semana ni la próxima. Ha sido absorbida — mantén la consistencia con el plan restante.`,
    },
  }
}

/** Find the first day in `candidates` where adding `session` creates no violations. */
function findValidRescheduleDay(
  session: GeneratedSession,
  existingSessions: GeneratedSession[],
  candidates: DayKey[]
): DayKey | undefined {
  for (const day of candidates) {
    // Check day not already occupied
    if (
      existingSessions.some(
        (s) => s.day === day && s.discipline !== 'rest' && s.discipline !== 'active_recovery'
      )
    ) {
      continue
    }
    // Check R1: no back-to-back hard session of same discipline
    if (session.isHardSession) {
      const testSessions = [...existingSessions, { ...session, day, dayIndex: DAY_INDEX[day] }]
      if (findBackToBackHardViolation(testSessions) !== null) continue
    }
    return day
  }
  return undefined
}

// ── Trigger: FATIGUE SIGNAL ───────────────────────────────────────────────────

/**
 * Determine whether a fatigue signal is present from RPE or HRV data.
 */
export function detectFatigue(trigger: FatigueSignalTrigger): {
  detected: boolean
  reason: 'rpe' | 'hrv' | 'both' | 'none'
  severity: 'mild' | 'moderate' | 'none'
} {
  let rpeTriggered = false
  let hrvTriggered = false

  // RPE check: need ≥ FATIGUE_RPE_MIN_SESSIONS data points
  if (trigger.recentRpe.length >= FATIGUE_RPE_MIN_SESSIONS) {
    const last = trigger.recentRpe.slice(-FATIGUE_RPE_MIN_SESSIONS)
    const avg = last.reduce((s, v) => s + v, 0) / last.length
    rpeTriggered = avg >= FATIGUE_RPE_THRESHOLD
  }

  // HRV check
  if (
    trigger.hrvBaseline !== undefined &&
    trigger.currentHrv !== undefined &&
    trigger.hrvBaseline > 0
  ) {
    const dropFraction = (trigger.hrvBaseline - trigger.currentHrv) / trigger.hrvBaseline
    hrvTriggered = dropFraction >= FATIGUE_HRV_DROP_FRACTION
  }

  const detected = rpeTriggered || hrvTriggered
  const reason =
    rpeTriggered && hrvTriggered ? 'both' : rpeTriggered ? 'rpe' : hrvTriggered ? 'hrv' : 'none'

  // Severity: both signals = moderate; single signal = mild
  const severity = !detected ? 'none' : reason === 'both' ? 'moderate' : 'mild'

  return { detected, reason, severity }
}

/**
 * Handle a fatigue signal trigger.
 */
export function handleFatigueSignal(
  trigger: FatigueSignalTrigger,
  ctx: AthleteContext
): ReplanResult {
  const fatigueResult = detectFatigue(trigger)
  const changes: ReplanChange[] = []

  if (!fatigueResult.detected) {
    // No fatigue — return current plan unchanged
    return {
      trigger: 'fatigue_signal',
      schedule: buildSchedule(ctx.currentWeekSessions, ctx.weekStartDate),
      updatedWeeklyHours: ctx.weeklyHours,
      updatedIntensityDistribution: ctx.intensityDistribution,
      isForcedRecoveryWeek: false,
      changes: [],
      explanation: {
        en: 'No significant fatigue signal detected. Continue with the current plan.',
        es: 'No se detectó señal de fatiga significativa. Continúa con el plan actual.',
      },
    }
  }

  // Apply reduction
  const reductionFactor =
    fatigueResult.severity === 'moderate'
      ? FATIGUE_VOLUME_REDUCTION_HIGH
      : FATIGUE_VOLUME_REDUCTION_LOW
  const nextWeekHours =
    Math.round((ctx.nextWeekHours ?? ctx.weeklyHours) * reductionFactor * 10) / 10
  const shiftAmount = fatigueResult.severity === 'moderate' ? 0.07 : 0.05
  const newIntensity = shiftIntensityDown(ctx.intensityDistribution, shiftAmount)

  const reductionPct = Math.round((1 - reductionFactor) * 100)

  changes.push({
    kind: 'volume_reduced',
    description: {
      en: `Next week's target hours reduced by ${reductionPct}% (${ctx.nextWeekHours ?? ctx.weeklyHours}h → ${nextWeekHours}h) due to ${fatigueResult.reason} fatigue signal`,
      es: `Las horas objetivo de la próxima semana se reducen un ${reductionPct}% (${ctx.nextWeekHours ?? ctx.weeklyHours}h → ${nextWeekHours}h) por señal de fatiga: ${fatigueResult.reason}`,
    },
  })

  changes.push({
    kind: 'intensity_shifted_down',
    description: {
      en: `Intensity distribution shifted toward easier zones (hard zone fraction reduced by ~${Math.round(shiftAmount * 100)}%)`,
      es: `La distribución de intensidad se desplaza hacia zonas más suaves (fracción de zona dura reducida ~${Math.round(shiftAmount * 100)}%)`,
    },
  })

  changes.push({
    kind: 'week_marked_recovery',
    description: {
      en: 'Next week marked as forced recovery week',
      es: 'La próxima semana marcada como semana de recuperación forzada',
    },
  })

  // Rebuild next week's sessions with reduced load (if next week data available)
  let nextSessions: GeneratedSession[] = ctx.nextWeekSessions ?? []
  if (ctx.nextWeekAvailableDays) {
    const nextInput: WeekSessionInput = {
      phase: ctx.phase,
      targetHours: nextWeekHours,
      intensityDistribution: newIntensity,
      disciplineSplit: ctx.disciplineSplit,
      availableDays: ctx.nextWeekAvailableDays,
      experienceLevel: ctx.experienceLevel,
      raceDistance: ctx.raceDistance,
      isRecoveryWeek: true,
    }
    nextSessions = generateWeekSessions(nextInput)
  }

  const reasonText: Record<string, string> = {
    rpe: 'high RPE across recent sessions',
    hrv: 'HRV drop below baseline',
    both: 'combined high RPE and HRV suppression',
  }
  const reasonEs: Record<string, string> = {
    rpe: 'RPE elevado en sesiones recientes',
    hrv: 'caída de VFC por debajo de la línea base',
    both: 'RPE elevado y supresión de VFC combinados',
  }

  return {
    trigger: 'fatigue_signal',
    schedule: buildTwoWeekSchedule(ctx.currentWeekSessions, nextSessions, ctx.weekStartDate),
    updatedWeeklyHours: nextWeekHours,
    updatedIntensityDistribution: newIntensity,
    isForcedRecoveryWeek: true,
    changes,
    explanation: {
      en: `Fatigue detected (${reasonText[fatigueResult.reason] ?? fatigueResult.reason}, ${fatigueResult.severity} severity). Next week's training load has been reduced by ${reductionPct}% and intensity shifted downward to allow full recovery.`,
      es: `Fatiga detectada (${reasonEs[fatigueResult.reason] ?? fatigueResult.reason}, severidad ${fatigueResult.severity}). La carga de entrenamiento de la próxima semana se ha reducido un ${reductionPct}% y la intensidad se desplaza hacia abajo para permitir una recuperación completa.`,
    },
  }
}

// ── Trigger: AVAILABILITY CHANGE ──────────────────────────────────────────────

/**
 * Handle days becoming unavailable mid-week.
 *
 * Algorithm:
 *  1. Identify sessions planned on removed days.
 *  2. Classify each as key or secondary.
 *  3. For key sessions: attempt to fit on remaining days respecting:
 *       a. ≤ MAX_HARD_PER_DAY hard sessions per day.
 *       b. No back-to-back hard sessions of the same discipline.
 *  4. Secondary sessions that can't fit: drop.
 *  5. Key sessions that can't fit after trying all remaining days: drop with note.
 */
export function handleAvailabilityChange(
  trigger: AvailabilityChangeTrigger,
  ctx: AthleteContext
): ReplanResult {
  const { removedDays, remainingDays, plannedSessions } = trigger
  const changes: ReplanChange[] = []

  const removedSet = new Set(removedDays)

  // Split sessions into kept (days still available) and displaced (removed days)
  const keptSessions = plannedSessions.filter((s) => !removedSet.has(s.day))
  const displaced = plannedSessions.filter((s) => removedSet.has(s.day))

  // Track what's on each remaining day
  const daySessionMap = new Map<DayKey, GeneratedSession[]>()
  for (const d of remainingDays) daySessionMap.set(d, [])
  for (const s of keptSessions) {
    const arr = daySessionMap.get(s.day)
    if (arr) arr.push(s)
  }

  const hardCountOnDay = (day: DayKey): number =>
    (daySessionMap.get(day) ?? []).filter((s) => s.isHardSession).length

  function canFitHard(day: DayKey, session: GeneratedSession): boolean {
    if (hardCountOnDay(day) >= MAX_HARD_PER_DAY) return false
    const test = [
      ...keptSessions,
      ...displaced.filter((s) => daySessionMap.has(s.day)),
      { ...session, day, dayIndex: DAY_INDEX[day] },
    ]
    return findBackToBackHardViolation(test) === null
  }

  const finalSessions: GeneratedSession[] = [...keptSessions]

  for (const s of displaced) {
    const priority = classifySession(s)

    if (priority === 'secondary') {
      changes.push({
        kind: 'session_dropped',
        description: {
          en: `Secondary ${s.discipline} session (${s.day}) dropped — day unavailable`,
          es: `Sesión secundaria de ${s.discipline} (${s.day}) eliminada — día no disponible`,
        },
      })
      continue
    }

    // Key session: try to fit on a remaining day
    const candidateDays = remainingDays
      .filter((d) => {
        // Don't put two discipline sessions on same day unless the existing one is rest
        const existing = daySessionMap.get(d) ?? []
        const activeCount = existing.filter(
          (e) => e.discipline !== 'rest' && e.discipline !== 'active_recovery'
        ).length
        return activeCount === 0
      })
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])

    // Relaxed: if no completely free day, allow days with 1 easy session
    const relaxedCandidates = remainingDays
      .filter((d) => {
        const existing = daySessionMap.get(d) ?? []
        const hardCount = existing.filter((e) => e.isHardSession).length
        return s.isHardSession ? canFitHard(d, s) : hardCount < MAX_HARD_PER_DAY
      })
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])

    const targetDay = candidateDays[0] ?? relaxedCandidates[0]

    if (targetDay) {
      const moved: GeneratedSession = { ...s, day: targetDay, dayIndex: DAY_INDEX[targetDay] }
      const arr = daySessionMap.get(targetDay)
      if (arr) arr.push(moved)
      finalSessions.push(moved)

      changes.push({
        kind: 'session_moved',
        description: {
          en: `Key ${s.discipline} session moved from ${s.day} → ${targetDay}`,
          es: `Sesión clave de ${s.discipline} movida de ${s.day} → ${targetDay}`,
        },
      })

      // Enforce hard cap note
      if (s.isHardSession && hardCountOnDay(targetDay) >= MAX_HARD_PER_DAY) {
        changes.push({
          kind: 'hard_cap_applied',
          description: {
            en: `Hard session cap (${MAX_HARD_PER_DAY}/day) reached on ${targetDay} — session placed as easy`,
            es: `Límite de sesiones duras (${MAX_HARD_PER_DAY}/día) alcanzado el ${targetDay} — sesión colocada como suave`,
          },
        })
      }
    } else {
      changes.push({
        kind: 'session_dropped',
        description: {
          en: `Key ${s.discipline} session (${s.day}) could not be moved — no suitable slot in remaining days`,
          es: `La sesión clave de ${s.discipline} (${s.day}) no pudo moverse — no hay espacio disponible en los días restantes`,
        },
      })
    }
  }

  const removedStr = removedDays.join(', ')

  return {
    trigger: 'availability_change',
    schedule: buildSchedule(finalSessions, ctx.weekStartDate),
    updatedWeeklyHours: ctx.weeklyHours,
    updatedIntensityDistribution: ctx.intensityDistribution,
    isForcedRecoveryWeek: false,
    changes,
    explanation: {
      en: `Availability changed: ${removedStr} removed. ${changes.filter((c) => c.kind === 'session_moved').length} session(s) relocated; ${changes.filter((c) => c.kind === 'session_dropped').length} session(s) dropped.`,
      es: `Disponibilidad modificada: ${removedStr} eliminados. ${changes.filter((c) => c.kind === 'session_moved').length} sesión(es) reubicadas; ${changes.filter((c) => c.kind === 'session_dropped').length} sesión(es) eliminadas.`,
    },
  }
}

// ── Trigger: OVERPERFORMANCE ──────────────────────────────────────────────────

/**
 * Determine whether recent completions consistently exceed targets.
 */
export function detectOverperformance(completed: CompletedSession[]): {
  detected: boolean
  durationOverperformers: number
  zoneOverperformers: number
} {
  if (completed.length < OVERPERFORMANCE_MIN_SESSIONS) {
    return { detected: false, durationOverperformers: 0, zoneOverperformers: 0 }
  }

  const recent = completed.slice(-OVERPERFORMANCE_MIN_SESSIONS)

  const durationOverperformers = recent.filter(
    (c) => c.actualDurationMinutes >= c.planned.durationMinutes * OVERPERFORMANCE_DURATION_RATIO
  ).length

  const zoneOverperformers = recent.filter(
    (c) => zoneRank(c.actualPrimaryZone) > zoneRank(c.planned.primaryZone)
  ).length

  const detected =
    durationOverperformers >= OVERPERFORMANCE_MIN_SESSIONS ||
    zoneOverperformers >= OVERPERFORMANCE_MIN_SESSIONS

  return { detected, durationOverperformers, zoneOverperformers }
}

/**
 * Handle overperformance trigger.
 */
export function handleOverperformance(
  trigger: OverperformanceTrigger,
  ctx: AthleteContext
): ReplanResult {
  const result = detectOverperformance(trigger.completedSessions)
  const changes: ReplanChange[] = []

  if (!result.detected) {
    return {
      trigger: 'overperformance',
      schedule: buildSchedule(ctx.currentWeekSessions, ctx.weekStartDate),
      updatedWeeklyHours: ctx.weeklyHours,
      updatedIntensityDistribution: ctx.intensityDistribution,
      isForcedRecoveryWeek: false,
      changes: [],
      explanation: {
        en: 'No consistent overperformance detected. Continue with the current plan.',
        es: 'No se detectó superación consistente. Continúa con el plan actual.',
      },
    }
  }

  // Volume bump (capped)
  const baseHours = ctx.nextWeekHours ?? ctx.weeklyHours
  const bumpedHours = Math.min(
    Math.round(baseHours * (1 + OVERPERFORMANCE_VOLUME_BUMP) * 10) / 10,
    Math.round(ctx.weeklyHours * OVERPERFORMANCE_VOLUME_CAP * 10) / 10
  )

  if (bumpedHours > baseHours) {
    changes.push({
      kind: 'volume_increased',
      description: {
        en: `Next week's target hours increased by ${Math.round(OVERPERFORMANCE_VOLUME_BUMP * 100)}% (${baseHours}h → ${bumpedHours}h)`,
        es: `Las horas objetivo de la próxima semana aumentan un ${Math.round(OVERPERFORMANCE_VOLUME_BUMP * 100)}% (${baseHours}h → ${bumpedHours}h)`,
      },
    })
  }

  // Intensity bump (only if zone overperformance detected)
  const newIntensity =
    result.zoneOverperformers >= OVERPERFORMANCE_MIN_SESSIONS
      ? shiftIntensityUp(ctx.intensityDistribution)
      : ctx.intensityDistribution

  if (result.zoneOverperformers >= OVERPERFORMANCE_MIN_SESSIONS) {
    changes.push({
      kind: 'intensity_shifted_up',
      description: {
        en: `Intensity distribution nudged upward — athletes consistently achieving higher zones`,
        es: `Distribución de intensidad incrementada — los atletas alcanzan consistentemente zonas más altas`,
      },
    })
  }

  // Rebuild next week sessions with updated load
  let nextSessions: GeneratedSession[] = ctx.nextWeekSessions ?? []
  if (ctx.nextWeekAvailableDays) {
    const nextInput: WeekSessionInput = {
      phase: ctx.phase,
      targetHours: bumpedHours,
      intensityDistribution: newIntensity,
      disciplineSplit: ctx.disciplineSplit,
      availableDays: ctx.nextWeekAvailableDays,
      experienceLevel: ctx.experienceLevel,
      raceDistance: ctx.raceDistance,
      isRecoveryWeek: false,
    }
    nextSessions = generateWeekSessions(nextInput)
  }

  return {
    trigger: 'overperformance',
    schedule: buildTwoWeekSchedule(ctx.currentWeekSessions, nextSessions, ctx.weekStartDate),
    updatedWeeklyHours: bumpedHours,
    updatedIntensityDistribution: newIntensity,
    isForcedRecoveryWeek: false,
    changes,
    explanation: {
      en: `Consistent overperformance detected across ${OVERPERFORMANCE_MIN_SESSIONS}+ recent sessions (${result.durationOverperformers} duration, ${result.zoneOverperformers} zone). Next micro-cycle nudged upward: ${bumpedHours}h target, slightly higher intensity.`,
      es: `Superación consistente detectada en ${OVERPERFORMANCE_MIN_SESSIONS}+ sesiones recientes (${result.durationOverperformers} duración, ${result.zoneOverperformers} zona). El siguiente micro-ciclo se ajusta al alza: objetivo ${bumpedHours}h, intensidad ligeramente mayor.`,
    },
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

/**
 * Route a replan trigger to its handler and return a `ReplanResult`.
 *
 * This is the primary entry point for the adaptive replanning engine.
 *
 * @param trigger  The event that caused the replan.
 * @param ctx      Current athlete and plan context.
 */
export function replan(trigger: ReplanTrigger, ctx: AthleteContext): ReplanResult {
  switch (trigger.type) {
    case 'missed_session':
      return handleMissedSession(trigger, ctx)
    case 'fatigue_signal':
      return handleFatigueSignal(trigger, ctx)
    case 'availability_change':
      return handleAvailabilityChange(trigger, ctx)
    case 'overperformance':
      return handleOverperformance(trigger, ctx)
  }
}
