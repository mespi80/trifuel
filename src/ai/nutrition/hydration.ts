/**
 * Hydration calculator for triathlon athletes.
 *
 * Computes:
 *   - Daily total target (base + training supplement)
 *   - Per-session hydration guidance (timing + amounts)
 *   - Sodium target for long sessions
 *   - Over-hydration risk flag
 *   - Electrolyte panel for training days
 */

import type { SessionInput, IntensityZone } from './macro-calculator'

// ── Constants ──────────────────────────────────────────────────────────────────

export const HYDRATION_BASE_ML_PER_KG = 35 // ml/kg bodyweight
export const HYDRATION_TRAINING_MIN_ML_PER_HR = 500 // ml/hr exercise (Z1)
export const HYDRATION_TRAINING_MAX_ML_PER_HR = 750 // ml/hr exercise (Z5+)
export const SODIUM_LONG_SESSION_THRESHOLD_MIN = 60 // sessions longer than this need sodium
export const SODIUM_MIN_MG_PER_HR = 300 // mg/hr of exercise
export const SODIUM_MAX_MG_PER_HR = 600 // mg/hr (hot/humid, Z4+)
export const OVER_HYDRATION_ML_PER_HR = 1000 // flag if intake > this rate

// ── Zone intensity scale (0–1) ────────────────────────────────────────────────

const ZONE_INTENSITY_SCALE: Record<IntensityZone, number> = {
  z1: 0.0, // minimal sweat
  z2: 0.25,
  z3: 0.5,
  z4: 0.75,
  z5: 1.0,
  z6: 1.0,
}

function intensityScale(zone: IntensityZone | null | undefined): number {
  if (!zone) return 0.5 // default: moderate
  return ZONE_INTENSITY_SCALE[zone]
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionHydrationGuide {
  discipline: SessionInput['discipline']
  durationMinutes: number
  intensityZone: IntensityZone | null
  /** Total fluid to consume during the session (ml) */
  duringSessionMl: number
  /** Fluid to drink 30–60 min before the session (ml) */
  preMl: number
  /** Fluid to drink in the 30 min after the session (ml) */
  postMl: number
  /** Sodium needed during session (mg); 0 if session ≤ 60 min */
  sodiumMg: number
  /** Suggested sip rate: X ml every Y minutes */
  sipRateMl: number
  sipEveryMinutes: number
}

export interface DailyHydrationTarget {
  /** Base daily fluid requirement (ml) */
  baseMl: number
  /** Additional fluid for all training sessions (ml) */
  trainingMl: number
  /** Total daily target (ml) */
  totalMl: number
  /** Individual session guidance */
  sessions: SessionHydrationGuide[]
}

export interface ElectrolyteTarget {
  sodiumMg: number // typically 1500–2300 mg/day; higher on hard days
  potassiumMg: number // 3500–4700 mg/day
  magnesiumMg: number // 310–420 mg/day; higher for athletes
  /** True if this is a training day requiring higher electrolyte intake */
  trainingDay: boolean
}

export interface HydrationLog {
  loggedAt: Date
  amountMl: number
}

export interface OverHydrationCheck {
  risk: boolean
  /** Highest hourly rate detected (ml/hr) */
  peakRateMlPerHr: number
  /** ISO timestamp of the window that triggered the flag */
  windowStart?: string
}

// ── Session guidance ───────────────────────────────────────────────────────────

/**
 * Calculates hydration guidance for a single training session.
 */
export function calculateSessionHydration(session: SessionInput): SessionHydrationGuide {
  const scale = intensityScale(session.intensityZone ?? null)
  const hours = session.durationMinutes / 60

  // During: linear interpolation between min and max based on zone intensity
  const mlPerHr =
    HYDRATION_TRAINING_MIN_ML_PER_HR +
    (HYDRATION_TRAINING_MAX_ML_PER_HR - HYDRATION_TRAINING_MIN_ML_PER_HR) * scale
  const duringSessionMl = Math.round(mlPerHr * hours)

  // Pre: 400–600 ml 30–60 min before; more for longer / harder sessions
  const preMl = Math.round(400 + 200 * scale)

  // Post: 500 ml base + replace ~150% of sweat deficit (estimated)
  const postMl = Math.round(500 + duringSessionMl * 0.5)

  // Sodium: only for sessions > 60 min
  let sodiumMg = 0
  if (session.durationMinutes > SODIUM_LONG_SESSION_THRESHOLD_MIN) {
    const sodiumPerHr = SODIUM_MIN_MG_PER_HR + (SODIUM_MAX_MG_PER_HR - SODIUM_MIN_MG_PER_HR) * scale
    sodiumMg = Math.round(sodiumPerHr * hours)
  }

  // Sip rate: divide during-session fluid across convenient intervals
  const sipEveryMinutes = session.durationMinutes >= 60 ? 15 : 20
  const sipRateMl = Math.round((duringSessionMl / session.durationMinutes) * sipEveryMinutes)

  return {
    discipline: session.discipline,
    durationMinutes: session.durationMinutes,
    intensityZone: session.intensityZone ?? null,
    duringSessionMl,
    preMl,
    postMl,
    sodiumMg,
    sipRateMl,
    sipEveryMinutes,
  }
}

// ── Daily target ───────────────────────────────────────────────────────────────

/**
 * Calculates the full daily hydration target.
 *
 * Recovery sessions do not add training hydration (same logic as macro-calculator).
 */
export function calculateDailyHydration(
  weightKg: number,
  sessions: SessionInput[]
): DailyHydrationTarget {
  const baseMl = Math.round(HYDRATION_BASE_ML_PER_KG * weightKg)

  const activeSessions = sessions.filter((s) => s.discipline !== 'recovery')

  const sessionGuides = activeSessions.map(calculateSessionHydration)
  const trainingMl = sessionGuides.reduce((sum, g) => sum + g.duringSessionMl, 0)

  return {
    baseMl,
    trainingMl,
    totalMl: baseMl + trainingMl,
    sessions: sessionGuides,
  }
}

// ── Electrolyte panel ──────────────────────────────────────────────────────────

/**
 * Calculates daily electrolyte targets.
 *
 * Baseline recommendations are scaled up on training days:
 *   - Sodium:    1500 mg rest → up to 3000 mg hard training
 *   - Potassium: 3500 mg rest → up to 4500 mg hard training
 *   - Magnesium: 320 mg rest  → up to 450 mg hard training
 *
 * @param sessions  Active training sessions for the day
 * @param sweatRateFactor  Optional 0–1 multiplier for individual sweat rate (default 0.5)
 */
export function calculateElectrolytes(
  sessions: SessionInput[],
  sweatRateFactor = 0.5
): ElectrolyteTarget {
  const active = sessions.filter((s) => s.discipline !== 'recovery')
  const trainingDay = active.length > 0

  // Aggregate zone intensity across sessions (weighted average by duration)
  let totalWeightedScale = 0
  let totalDuration = 0
  for (const s of active) {
    const scale = intensityScale(s.intensityZone ?? null)
    totalWeightedScale += scale * s.durationMinutes
    totalDuration += s.durationMinutes
  }
  const avgScale = totalDuration > 0 ? totalWeightedScale / totalDuration : 0

  // Combined scale: intensity × sweat rate factor
  const adjustedScale = avgScale * sweatRateFactor + avgScale * (1 - sweatRateFactor)

  const sodiumMg = Math.round(1500 + (trainingDay ? 1500 * adjustedScale : 0))
  const potassiumMg = Math.round(3500 + (trainingDay ? 1000 * adjustedScale : 0))
  const magnesiumMg = Math.round(320 + (trainingDay ? 130 * adjustedScale : 0))

  return { sodiumMg, potassiumMg, magnesiumMg, trainingDay }
}

// ── Over-hydration check ───────────────────────────────────────────────────────

/**
 * Checks if a sequence of timestamped log entries indicates a risk of
 * over-hydration (>1 L consumed within any 60-minute window).
 *
 * @param logs  Logs sorted ascending by loggedAt (or unsorted — we sort internally)
 */
export function checkOverHydration(logs: HydrationLog[]): OverHydrationCheck {
  if (logs.length < 2) return { risk: false, peakRateMlPerHr: 0 }

  const sorted = [...logs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())

  let peakRateMlPerHr = 0
  let windowStartIso: string | undefined

  // Sliding window: for each log entry as the "end" of a 60-min window,
  // sum all entries within the preceding hour.
  for (let end = 0; end < sorted.length; end++) {
    const endTime = sorted[end]!.loggedAt.getTime()
    const startTime = endTime - 60 * 60 * 1000 // 1 hour earlier

    let windowMl = 0
    for (let i = end; i >= 0; i--) {
      if (sorted[i]!.loggedAt.getTime() < startTime) break
      windowMl += sorted[i]!.amountMl
    }

    // Convert window total to hourly rate
    const rate = windowMl // already in a 1-hr window → rate ≡ ml/hr
    if (rate > peakRateMlPerHr) {
      peakRateMlPerHr = rate
      windowStartIso = new Date(startTime).toISOString()
    }
  }

  return {
    risk: peakRateMlPerHr > OVER_HYDRATION_ML_PER_HR,
    peakRateMlPerHr: Math.round(peakRateMlPerHr),
    windowStart: windowStartIso,
  }
}

// ── Session-specific guidance text ────────────────────────────────────────────

type Discipline = SessionInput['discipline']

const SESSION_HYDRATION_TIPS: Record<Discipline, (guide: SessionHydrationGuide) => string> = {
  swim: (g) =>
    `Drink ${g.preMl} ml before entering the pool. ` +
    `Although you don't feel sweat, you still lose ${g.duringSessionMl} ml during a ${g.durationMinutes}-min swim. ` +
    `Sip ${g.sipRateMl} ml every ${g.sipEveryMinutes} min at pool turns.` +
    (g.sodiumMg > 0 ? ` Sodium target: ${g.sodiumMg} mg (electrolyte drink).` : ''),

  bike: (g) =>
    `Pre-ride: ${g.preMl} ml 30–45 min before. ` +
    `Carry at least ${Math.ceil(g.duringSessionMl / 750)} bottle(s) (${g.duringSessionMl} ml total). ` +
    `Sip every ${g.sipEveryMinutes} min (~${g.sipRateMl} ml per sip).` +
    (g.sodiumMg > 0 ? ` Add ${g.sodiumMg} mg sodium to your bottles.` : ''),

  run: (g) =>
    `Drink ${g.preMl} ml 30 min before your run. ` +
    `If > 45 min, carry a soft flask (${g.duringSessionMl} ml total). ` +
    `Sip ${g.sipRateMl} ml every ${g.sipEveryMinutes} min.` +
    (g.sodiumMg > 0 ? ` Sodium: ${g.sodiumMg} mg — use electrolyte tabs.` : ''),

  brick: (g) =>
    `Brick session: Drink ${g.preMl} ml before starting. ` +
    `Total fluid: ${g.duringSessionMl} ml — front-load on the bike (70%) and carry a flask for the run. ` +
    (g.sodiumMg > 0 ? `Sodium: ${g.sodiumMg} mg split across bike and run.` : ''),

  strength: (g) =>
    `Sip water throughout: ${g.duringSessionMl} ml total over ${g.durationMinutes} min. ` +
    `${g.preMl} ml before and ${g.postMl} ml after.`,

  recovery: (_g) =>
    `Recovery day: sip water consistently throughout the day. Focus on restoring electrolyte balance.`,
}

/**
 * Returns a human-readable hydration tip for a specific session.
 */
export function getSessionHydrationTip(session: SessionInput): string {
  const guide = calculateSessionHydration(session)
  return SESSION_HYDRATION_TIPS[session.discipline](guide)
}
