/**
 * Discipline split engine — swim / bike / run time allocation per week.
 *
 * Default splits reflect the relative race demands of each triathlon distance
 * and the physiological priority of each phase.  They can be overridden by
 * the athlete's `disciplinePreferences` weighting.
 *
 * Principles:
 *   • Sprint / Olympic are more run-capped → higher run fraction.
 *   • Half Ironman / Ironman are dominated by the bike leg → higher bike fraction.
 *   • Base phase emphasises swimming (technique) and running (aerobic base),
 *     less structured bike.
 *   • Build phase balances all three; introduces brick work on the bike.
 *   • Peak phase reflects race-proportional demands.
 *   • Taper reduces swim volume most aggressively (least injury risk from
 *     maintaining it, but sessions are cut to preserve freshness).
 */

import type { RaceDistance, PhaseLabel, DisciplinePreference, DisciplineSplit } from './types'

// ── Default splits ─────────────────────────────────────────────────────────────

type PhaseSplitTable = Record<PhaseLabel, DisciplineSplit>

/** Default splits by race distance and phase. Fractions sum to 1. */
const DEFAULT_SPLITS: Record<RaceDistance, PhaseSplitTable> = {
  sprint: {
    base: { swim: 0.25, bike: 0.4, run: 0.35 },
    build: { swim: 0.22, bike: 0.4, run: 0.38 },
    peak: { swim: 0.2, bike: 0.38, run: 0.42 },
    taper: { swim: 0.18, bike: 0.38, run: 0.44 },
  },
  olympic: {
    base: { swim: 0.25, bike: 0.42, run: 0.33 },
    build: { swim: 0.22, bike: 0.42, run: 0.36 },
    peak: { swim: 0.2, bike: 0.42, run: 0.38 },
    taper: { swim: 0.18, bike: 0.4, run: 0.42 },
  },
  half_ironman: {
    base: { swim: 0.22, bike: 0.48, run: 0.3 },
    build: { swim: 0.2, bike: 0.5, run: 0.3 },
    peak: { swim: 0.18, bike: 0.52, run: 0.3 },
    taper: { swim: 0.16, bike: 0.52, run: 0.32 },
  },
  ironman: {
    base: { swim: 0.2, bike: 0.52, run: 0.28 },
    build: { swim: 0.18, bike: 0.54, run: 0.28 },
    peak: { swim: 0.16, bike: 0.56, run: 0.28 },
    taper: { swim: 0.14, bike: 0.56, run: 0.3 },
  },
}

// ── Preference blending ────────────────────────────────────────────────────────

/**
 * Blend the default split with an optional athlete preference.
 *
 * The preference is treated as an un-normalised weight vector.  The blended
 * result is a weighted average between the default split and the normalised
 * preference — with the preference contributing 30 % of the final split.
 *
 * @param defaultSplit     Engine's default split for this phase/distance.
 * @param prefs            Athlete's raw discipline preference weights.
 * @param preferenceWeight How strongly to apply the preference (0–1); default 0.3.
 */
export function blendWithPreferences(
  defaultSplit: DisciplineSplit,
  prefs?: DisciplinePreference,
  preferenceWeight = 0.3
): DisciplineSplit {
  if (!prefs || Object.keys(prefs).length === 0) return { ...defaultSplit }

  const rawSwim = prefs.swim ?? defaultSplit.swim
  const rawBike = prefs.bike ?? defaultSplit.bike
  const rawRun = prefs.run ?? defaultSplit.run
  const total = rawSwim + rawBike + rawRun

  if (total <= 0) return { ...defaultSplit }

  const normalised: DisciplineSplit = {
    swim: rawSwim / total,
    bike: rawBike / total,
    run: rawRun / total,
  }

  const w = Math.min(1, Math.max(0, preferenceWeight))

  return normaliseSplit({
    swim: (1 - w) * defaultSplit.swim + w * normalised.swim,
    bike: (1 - w) * defaultSplit.bike + w * normalised.bike,
    run: (1 - w) * defaultSplit.run + w * normalised.run,
  })
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the discipline split for a given week.
 *
 * @param raceDistance  Target race distance.
 * @param phase         Training phase.
 * @param prefs         Optional athlete preference weights.
 */
export function getDisciplineSplit(
  raceDistance: RaceDistance,
  phase: PhaseLabel,
  prefs?: DisciplinePreference
): DisciplineSplit {
  const defaultSplit = DEFAULT_SPLITS[raceDistance][phase]
  return blendWithPreferences(defaultSplit, prefs)
}

/**
 * Derive absolute hours per discipline from a split and total target hours.
 */
export function splitToHours(
  split: DisciplineSplit,
  targetHours: number
): { swim: number; bike: number; run: number } {
  return {
    swim: round2(split.swim * targetHours),
    bike: round2(split.bike * targetHours),
    run: round2(split.run * targetHours),
  }
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normaliseSplit(split: DisciplineSplit): DisciplineSplit {
  const swim = Math.max(0, split.swim)
  const bike = Math.max(0, split.bike)
  const run = Math.max(0, split.run)
  const total = swim + bike + run
  if (total === 0) return { swim: 0.33, bike: 0.34, run: 0.33 }
  return {
    swim: round2(swim / total),
    bike: round2(bike / total),
    run: round2(run / total),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
