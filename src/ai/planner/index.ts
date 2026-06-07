/**
 * Periodization plan generator — main entry point.
 *
 * Assembles the four sub-engines into a complete macro-level training plan:
 *   1. Phase allocation  (phases.ts)
 *   2. Intensity model   (intensity.ts)
 *   3. Volume curve      (volume.ts)
 *   4. Discipline split  (discipline.ts)
 *
 * Returns a `PeriodizationPlan` with:
 *   – High-level phase summaries
 *   – Week-by-week TrainingWeek objects
 *   – Metadata (model, peak week, generated-at)
 */

import type {
  PlannerInput,
  PeriodizationPlan,
  PhaseSummary,
  TrainingWeek,
  PhaseLabel,
} from './types'
import { allocatePhases, buildPhaseSequence, weeksUntilRace, PHASE_DESCRIPTIONS } from './phases'
import { selectIntensityModel, getIntensityDistribution } from './intensity'
import { weeklyVolume } from './volume'
import { getDisciplineSplit, splitToHours } from './discipline'

// ── Date helper ────────────────────────────────────────────────────────────────

/**
 * Return the ISO date string for the Monday of the week that contains `date`.
 */
function mondayOf(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day // offset to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]!
}

/**
 * Add `weeks` weeks to a Monday ISO date string.
 */
function addWeeks(mondayIso: string, weeks: number): string {
  const d = new Date(mondayIso)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]!
}

// ── Phase index lookup ─────────────────────────────────────────────────────────

interface PhaseIndex {
  phase: PhaseLabel
  indexInPhase: number // 0-based
  phaseLength: number
}

function buildPhaseIndex(sequence: PhaseLabel[]): PhaseIndex[] {
  const counts: Partial<Record<PhaseLabel, number>> = {}
  const result: PhaseIndex[] = []

  for (const phase of sequence) {
    if (counts[phase] === undefined) counts[phase] = 0
    result.push({
      phase,
      indexInPhase: counts[phase]!,
      phaseLength: 0, // filled in pass 2
    })
    counts[phase]! += 1
  }

  // Fill phaseLength
  for (const item of result) {
    item.phaseLength = counts[item.phase] ?? 1
  }

  return result
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Generate a complete periodization plan.
 *
 * @param input  See {@link PlannerInput}.
 */
export function generatePeriodizationPlan(input: PlannerInput): PeriodizationPlan {
  // ── 1. Resolve total weeks ────────────────────────────────────────────────
  const totalWeeks =
    input.weeksAvailable !== undefined && input.weeksAvailable > 0
      ? input.weeksAvailable
      : weeksUntilRace(input.raceDate)

  // ── 2. Allocate phases ────────────────────────────────────────────────────
  const { base, build, peak, taper } = allocatePhases(
    totalWeeks,
    input.raceDistance,
    input.experienceLevel
  )

  const sequence = buildPhaseSequence(base, build, peak, taper)
  const phaseIndex = buildPhaseIndex(sequence)

  // ── 3. Intensity model ────────────────────────────────────────────────────
  const intensityModel = selectIntensityModel(input.experienceLevel)

  // ── 4. Build week array ───────────────────────────────────────────────────
  const planStartMonday = mondayOf(new Date())
  const weeks: TrainingWeek[] = []
  let peakWeekIndex = 0
  let peakHours = 0

  for (let i = 0; i < sequence.length; i++) {
    const { phase, indexInPhase, phaseLength } = phaseIndex[i]!
    const weekNumber = i + 1
    const startDate = addWeeks(planStartMonday, i)
    const isPhaseStart = indexInPhase === 0

    // Volume
    const { targetHours, isRecoveryWeek } = weeklyVolume({
      phase,
      weekIndexInPhase: indexInPhase,
      phaseLength,
      weeklyHours: input.weeklyHours,
      raceDistance: input.raceDistance,
    })

    // Intensity
    const intensityDistribution = getIntensityDistribution(phase, intensityModel, isRecoveryWeek)

    // Discipline split
    const disciplineSplit = getDisciplineSplit(
      input.raceDistance,
      phase,
      input.disciplinePreferences
    )

    const disciplineHours = splitToHours(disciplineSplit, targetHours)

    if (targetHours > peakHours) {
      peakHours = targetHours
      peakWeekIndex = i
    }

    weeks.push({
      weekNumber,
      startDate,
      phase,
      targetHours,
      intensityDistribution,
      disciplineSplit,
      disciplineHours,
      isPhaseStart,
      isRecoveryWeek,
    })
  }

  // ── 5. Build phase summaries ──────────────────────────────────────────────
  const phaseOrder: PhaseLabel[] = ['base', 'build', 'peak', 'taper']
  const phaseSummaries: PhaseSummary[] = []

  for (const phaseLabel of phaseOrder) {
    const phaseWeeks = weeks.filter((w) => w.phase === phaseLabel)
    if (phaseWeeks.length === 0) continue

    const avgHours = phaseWeeks.reduce((s, w) => s + w.targetHours, 0) / phaseWeeks.length

    phaseSummaries.push({
      phase: phaseLabel,
      startWeek: phaseWeeks[0]!.weekNumber,
      endWeek: phaseWeeks[phaseWeeks.length - 1]!.weekNumber,
      durationWeeks: phaseWeeks.length,
      avgHoursPerWeek: Math.round(avgHours * 10) / 10,
      intensityModel,
      focusDescription: PHASE_DESCRIPTIONS[phaseLabel],
    })
  }

  return {
    input,
    totalWeeks: weeks.length,
    phases: phaseSummaries,
    weeks,
    intensityModel,
    peakWeekIndex,
    generatedAt: new Date().toISOString(),
  }
}

// Re-export types and sub-module utilities for consumers that need them
export type {
  PlannerInput,
  PeriodizationPlan,
  TrainingWeek,
  PhaseSummary,
  ZoneDistribution,
  DisciplineSplit,
  IntensityModel,
  RaceDistance,
  ExperienceLevel,
  PhaseLabel,
} from './types'

export { weeksUntilRace, allocatePhases, TAPER_WEEKS, PHASE_DESCRIPTIONS } from './phases'
export {
  selectIntensityModel,
  getIntensityDistribution,
  normalise,
  hardZoneFraction,
  easyZoneFraction,
} from './intensity'
export {
  weeklyVolume,
  taperVolume,
  rampVolume,
  isRecoveryWeek,
  taperReductionPct,
  RECOVERY_CADENCE,
  RECOVERY_VOLUME_FACTOR,
} from './volume'
export {
  getDisciplineSplit,
  splitToHours,
  blendWithPreferences,
  normaliseSplit,
} from './discipline'
