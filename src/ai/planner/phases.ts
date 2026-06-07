/**
 * Phase allocation engine.
 *
 * Determines how many weeks belong to each training phase given:
 *   – total available weeks
 *   – race distance (governs taper length and ratio tweaks)
 *   – experience level (minor ratio adjustments)
 *
 * Design principles:
 *   • Taper is fixed in weeks (not a ratio) so it is always long enough for
 *     physiological super-compensation before race day.
 *   • Remaining weeks are split between Base / Build / Peak using ratios that
 *     are tuned per race distance.
 *   • Hard minimums prevent pathologically short phases in short build-ups.
 *   • Any "leftover" weeks after rounding fall into Base (the safest phase to
 *     extend).
 */

import type { RaceDistance, ExperienceLevel, PhaseLabel, PhaseConfig } from './types'

// ── Taper lengths (weeks) per race distance ────────────────────────────────────

export const TAPER_WEEKS: Record<RaceDistance, number> = {
  sprint: 1,
  olympic: 2,
  half_ironman: 2,
  ironman: 3,
}

// ── Phase ratio defaults per race distance ─────────────────────────────────────
// Ratios apply to the non-taper weeks (base + build + peak = 1.0).
// Ironman leans heavier on base aerobic capacity; Sprint can tolerate more
// peak intensity relative to total time.

const DISTANCE_RATIOS: Record<RaceDistance, { base: number; build: number; peak: number }> = {
  sprint: { base: 0.42, build: 0.33, peak: 0.25 },
  olympic: { base: 0.44, build: 0.33, peak: 0.23 },
  half_ironman: { base: 0.47, build: 0.33, peak: 0.2 },
  ironman: { base: 0.5, build: 0.33, peak: 0.17 },
}

// ── Minimum phase lengths (weeks) ─────────────────────────────────────────────

const MIN_BASE: Record<RaceDistance, number> = {
  sprint: 2,
  olympic: 3,
  half_ironman: 4,
  ironman: 4,
}

const MIN_BUILD: Record<RaceDistance, number> = {
  sprint: 1,
  olympic: 2,
  half_ironman: 2,
  ironman: 3,
}

const MIN_PEAK: Record<RaceDistance, number> = {
  sprint: 1,
  olympic: 1,
  half_ironman: 1,
  ironman: 2,
}

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Calculate the number of complete weeks between today and a race date.
 * Returns at least 1.
 */
export function weeksUntilRace(raceDateIso: string): number {
  const race = new Date(raceDateIso)
  const today = new Date()
  // Truncate to day boundaries
  today.setHours(0, 0, 0, 0)
  race.setHours(0, 0, 0, 0)
  const diffMs = race.getTime() - today.getTime()
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
}

/**
 * Allocate total weeks into the four training phases.
 *
 * @returns An object with the number of weeks for each phase and a
 *          fully-populated PhaseConfig for downstream use.
 */
export function allocatePhases(
  totalWeeks: number,
  raceDistance: RaceDistance,
  experienceLevel: ExperienceLevel
): {
  base: number
  build: number
  peak: number
  taper: number
  config: PhaseConfig
} {
  const taperWeeks = TAPER_WEEKS[raceDistance]
  const nonTaperWeeks = Math.max(totalWeeks - taperWeeks, 4) // at least 4 non-taper weeks

  const ratios = { ...DISTANCE_RATIOS[raceDistance] }

  // Experienced athletes benefit from slightly more intensity work (build + peak)
  if (experienceLevel === 'advanced' || experienceLevel === 'elite') {
    ratios.base = Math.max(0.38, ratios.base - 0.04)
    ratios.build = Math.min(0.4, ratios.build + 0.02)
    ratios.peak = Math.min(0.28, ratios.peak + 0.02)
  }

  // Initial allocation via ratios (floored)
  let baseWeeks = Math.floor(nonTaperWeeks * ratios.base)
  let buildWeeks = Math.floor(nonTaperWeeks * ratios.build)
  let peakWeeks = Math.floor(nonTaperWeeks * ratios.peak)

  // Enforce minimums
  baseWeeks = Math.max(baseWeeks, MIN_BASE[raceDistance])
  buildWeeks = Math.max(buildWeeks, MIN_BUILD[raceDistance])
  peakWeeks = Math.max(peakWeeks, MIN_PEAK[raceDistance])

  // Absorb rounding remainder into base (safest extension)
  const allocated = baseWeeks + buildWeeks + peakWeeks
  if (allocated < nonTaperWeeks) {
    baseWeeks += nonTaperWeeks - allocated
  } else if (allocated > nonTaperWeeks) {
    // Over-allocated (can happen when minimums force it) — trim peak first, then build
    let excess = allocated - nonTaperWeeks
    const trimPeak = Math.min(excess, Math.max(0, peakWeeks - MIN_PEAK[raceDistance]))
    peakWeeks -= trimPeak
    excess -= trimPeak
    const trimBuild = Math.min(excess, Math.max(0, buildWeeks - MIN_BUILD[raceDistance]))
    buildWeeks -= trimBuild
    excess -= trimBuild
    baseWeeks -= excess // last resort
  }

  return {
    base: Math.max(1, baseWeeks),
    build: Math.max(1, buildWeeks),
    peak: Math.max(1, peakWeeks),
    taper: taperWeeks,
    config: {
      baseRatio: ratios.base,
      buildRatio: ratios.build,
      peakRatio: ratios.peak,
      taperWeeks,
      minBaseWeeks: MIN_BASE[raceDistance],
      minBuildWeeks: MIN_BUILD[raceDistance],
      minPeakWeeks: MIN_PEAK[raceDistance],
    },
  }
}

/**
 * Build the flat ordered phase sequence for a plan — an array of `PhaseLabel`
 * values with one entry per week in the correct phase order.
 */
export function buildPhaseSequence(
  baseWeeks: number,
  buildWeeks: number,
  peakWeeks: number,
  taperWeeks: number
): PhaseLabel[] {
  return [
    ...Array<PhaseLabel>(baseWeeks).fill('base'),
    ...Array<PhaseLabel>(buildWeeks).fill('build'),
    ...Array<PhaseLabel>(peakWeeks).fill('peak'),
    ...Array<PhaseLabel>(taperWeeks).fill('taper'),
  ]
}

/**
 * Text descriptions for each phase (used in PhaseSummary.focusDescription).
 */
export const PHASE_DESCRIPTIONS: Record<PhaseLabel, string> = {
  base: 'Build aerobic engine — long easy sessions, technique, and consistency. Zones 1–2.',
  build: 'Introduce threshold and VO₂max work. Increase training stress progressively. Zones 3–4.',
  peak: 'Race-specific intensity — interval sets at race pace, brick workouts. Zones 4–5.',
  taper: 'Volume reduction to achieve super-compensation. Maintain intensity, cut duration.',
}
