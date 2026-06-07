/**
 * Weekly volume (hours) progression engine.
 *
 * Design:
 *
 * BASE phase
 *   Starts at 70% of weeklyHours and linearly ramps to 90% over the phase.
 *   Recovery weeks every 4th week drop to 75% of that week's target.
 *
 * BUILD phase
 *   Starts at 90% of weeklyHours and ramps to 100% (peak volume).
 *   Recovery weeks every 3rd week drop to 75% of that week's target.
 *   (Shorter recovery interval = more stress → more frequent off-loading.)
 *
 * PEAK phase
 *   Holds near 100% of weeklyHours with slight variation (+/- 5 %).
 *   No hard recovery weeks — the taper follows immediately.
 *
 * TAPER phase
 *   Exponential volume reduction.
 *   Sprint / Olympic:    50 % → 30 %
 *   Half Ironman:        55 % → 35 %
 *   Ironman:             60 % → 35 %  (longer super-compensation window)
 *   Intensity is maintained (handled in intensity.ts).
 *
 * Recovery week placement:
 *   Determined by `RECOVERY_CADENCE` — a recovery week is inserted every
 *   N weeks within a phase.  Taper weeks are never marked as recovery weeks
 *   (the entire taper is already a volume-reduction block).
 */

import type { PhaseLabel, RaceDistance } from './types'

// ── Constants ──────────────────────────────────────────────────────────────────

/** Every N-th week within a phase becomes a recovery week. */
export const RECOVERY_CADENCE: Record<PhaseLabel, number> = {
  base: 4,
  build: 3,
  peak: 999, // no recovery weeks in peak
  taper: 999,
}

/** Volume factor for recovery weeks relative to their nominal target. */
export const RECOVERY_VOLUME_FACTOR = 0.75

/** Taper start/end volume factors (as fraction of weeklyHours). */
const TAPER_FACTORS: Record<RaceDistance, [number, number]> = {
  sprint: [0.5, 0.3],
  olympic: [0.52, 0.32],
  half_ironman: [0.55, 0.35],
  ironman: [0.6, 0.35],
}

// ── Base / Build ramp helpers ──────────────────────────────────────────────────

/**
 * Linear interpolation of target volume across a phase.
 *
 * @param weekIndexInPhase  0-based index within the phase.
 * @param phaseLength       Total number of weeks in the phase.
 * @param weeklyHours       Athlete's peak weekly training target.
 * @param startFactor       Volume factor at the first week of the phase.
 * @param endFactor         Volume factor at the last week of the phase.
 */
export function rampVolume(
  weekIndexInPhase: number,
  phaseLength: number,
  weeklyHours: number,
  startFactor: number,
  endFactor: number
): number {
  if (phaseLength <= 1) return weeklyHours * endFactor

  const t = weekIndexInPhase / (phaseLength - 1) // 0 → 1
  const factor = startFactor + t * (endFactor - startFactor)
  return round2(weeklyHours * factor)
}

// ── Taper helpers ──────────────────────────────────────────────────────────────

/**
 * Exponential volume decay for the taper phase.
 * Week 0 of taper = highest taper volume; last week = lowest.
 */
export function taperVolume(
  weekIndexInPhase: number,
  phaseLength: number,
  weeklyHours: number,
  raceDistance: RaceDistance
): number {
  const [startFactor, endFactor] = TAPER_FACTORS[raceDistance]

  if (phaseLength <= 1) return round2(weeklyHours * endFactor)

  // Exponential decay: factor = start × (end/start)^t
  const t = weekIndexInPhase / (phaseLength - 1)
  const factor = startFactor * Math.pow(endFactor / startFactor, t)
  return round2(weeklyHours * factor)
}

/**
 * The taper reduction percentage for a race distance.
 * Returns [startPct, endPct] as 0–100 values.
 */
export function taperReductionPct(raceDistance: RaceDistance): [number, number] {
  const [start, end] = TAPER_FACTORS[raceDistance]
  return [Math.round((1 - start) * 100), Math.round((1 - end) * 100)]
}

// ── Recovery week classification ───────────────────────────────────────────────

/**
 * Returns true if `weekIndexInPhase` (0-based) should be a recovery week
 * for the given phase.
 *
 * Recovery weeks fall on the cadence boundary:
 *   index + 1 ≡ 0 (mod cadence)  → last week of every N-week block.
 */
export function isRecoveryWeek(weekIndexInPhase: number, phase: PhaseLabel): boolean {
  if (phase === 'taper' || phase === 'peak') return false
  const cadence = RECOVERY_CADENCE[phase]
  // 1-based position within the phase
  const position = weekIndexInPhase + 1
  return position % cadence === 0
}

// ── Master volume calculator ───────────────────────────────────────────────────

interface VolumeParams {
  phase: PhaseLabel
  weekIndexInPhase: number
  phaseLength: number
  weeklyHours: number
  raceDistance: RaceDistance
}

/**
 * Calculate the target hours for a single week.
 *
 * Returns `{ targetHours, isRecoveryWeek }`.
 */
export function weeklyVolume(params: VolumeParams): {
  targetHours: number
  isRecoveryWeek: boolean
} {
  const { phase, weekIndexInPhase, phaseLength, weeklyHours, raceDistance } = params

  const recovery = isRecoveryWeek(weekIndexInPhase, phase)

  let nominal: number

  switch (phase) {
    case 'base':
      nominal = rampVolume(weekIndexInPhase, phaseLength, weeklyHours, 0.7, 0.9)
      break

    case 'build':
      nominal = rampVolume(weekIndexInPhase, phaseLength, weeklyHours, 0.9, 1.0)
      break

    case 'peak':
      // Slight undulation: odd index weeks are marginally higher
      nominal = round2(weeklyHours * (weekIndexInPhase % 2 === 0 ? 0.97 : 1.0))
      break

    case 'taper':
      nominal = taperVolume(weekIndexInPhase, phaseLength, weeklyHours, raceDistance)
      break
  }

  const targetHours = recovery ? round2(nominal * RECOVERY_VOLUME_FACTOR) : nominal

  return { targetHours, isRecoveryWeek: recovery }
}

// ── Utility ────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
