/**
 * Intensity distribution engine.
 *
 * Two models are supported, consistent with endurance sport research:
 *
 * POLARIZED (Seiler, 2010) — beginners
 *   ≈ 80 % of time in zones 1–2 (easy aerobic)
 *   ≈  0 % in zone 3 (the "moderate" band is actively avoided)
 *   ≈ 20 % in zones 4–5 (hard)
 *
 *   Rationale: beginners lack the aerobic base to recover from pyramidal
 *   loading; the "grey zone" (Z3) is fatiguing without strong adaptation
 *   stimulus.  80/20 polarization maximises aerobic development.
 *
 * PYRAMIDAL (Stöggl & Sperlich, 2014) — intermediate / advanced / elite
 *   Most time in zone 1 (largest base), progressively less in each
 *   higher zone.  Allows more volume in the moderate band as fitness
 *   improves.  Resembles a triangle: Z1 > Z2 > Z3 > Z4 > Z5.
 *
 * Both models are further modulated per phase:
 *   Base  — shift toward easy zones
 *   Build — balanced; threshold zones grow
 *   Peak  — maximum hard-zone allocation
 *   Taper — high intensity preserved, Z1 dominates by volume cut
 */

import type { PhaseLabel, ExperienceLevel, IntensityModel, ZoneDistribution } from './types'

// ── Model selection ────────────────────────────────────────────────────────────

export function selectIntensityModel(level: ExperienceLevel): IntensityModel {
  return level === 'beginner' ? 'polarized' : 'pyramidal'
}

// ── Zone distribution tables ───────────────────────────────────────────────────
// Each row corresponds to a [phase][model] combination.
// Fractions must sum to 1.00 (enforced by normalise() at runtime).

type PhaseDistributions = Record<PhaseLabel, ZoneDistribution>

/** Polarized distributions — strict 80/20 split, no Z3 "grey zone". */
const POLARIZED: PhaseDistributions = {
  base: {
    z1: 0.65,
    z2: 0.22,
    z3: 0.0,
    z4: 0.1,
    z5: 0.03,
  },
  build: {
    z1: 0.58,
    z2: 0.2,
    z3: 0.0,
    z4: 0.15,
    z5: 0.07,
  },
  peak: {
    z1: 0.52,
    z2: 0.18,
    z3: 0.0,
    z4: 0.18,
    z5: 0.12,
  },
  taper: {
    z1: 0.6,
    z2: 0.18,
    z3: 0.0,
    z4: 0.15,
    z5: 0.07,
  },
}

/** Pyramidal distributions — progressive step-down from Z1 to Z5. */
const PYRAMIDAL: PhaseDistributions = {
  base: {
    z1: 0.55,
    z2: 0.25,
    z3: 0.1,
    z4: 0.07,
    z5: 0.03,
  },
  build: {
    z1: 0.45,
    z2: 0.25,
    z3: 0.15,
    z4: 0.1,
    z5: 0.05,
  },
  peak: {
    z1: 0.38,
    z2: 0.22,
    z3: 0.15,
    z4: 0.15,
    z5: 0.1,
  },
  taper: {
    z1: 0.48,
    z2: 0.24,
    z3: 0.12,
    z4: 0.11,
    z5: 0.05,
  },
}

const TABLES: Record<IntensityModel, PhaseDistributions> = {
  polarized: POLARIZED,
  pyramidal: PYRAMIDAL,
}

// ── Recovery week modifier ─────────────────────────────────────────────────────
// Recovery weeks shift intensity toward Z1 by redistributing 5 pp from
// hard zones (Z4/Z5 equally) to Z1.  Volume is reduced separately in volume.ts.

const RECOVERY_SHIFT = 0.05 // 5 percentage points

function applyRecoveryShift(dist: ZoneDistribution): ZoneDistribution {
  const z4reduction = Math.min(dist.z4, RECOVERY_SHIFT / 2)
  const z5reduction = Math.min(dist.z5, RECOVERY_SHIFT / 2)
  const shift = z4reduction + z5reduction
  return normalise({
    z1: dist.z1 + shift,
    z2: dist.z2,
    z3: dist.z3,
    z4: dist.z4 - z4reduction,
    z5: dist.z5 - z5reduction,
  })
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Ensure all zone fractions are non-negative and sum exactly to 1.
 * Corrects for floating-point drift in the tables.
 */
export function normalise(dist: ZoneDistribution): ZoneDistribution {
  const sum = dist.z1 + dist.z2 + dist.z3 + dist.z4 + dist.z5
  if (sum === 0) {
    // Degenerate: fall back to pure Z1
    return { z1: 1, z2: 0, z3: 0, z4: 0, z5: 0 }
  }
  const z1 = Math.max(0, dist.z1)
  const z2 = Math.max(0, dist.z2)
  const z3 = Math.max(0, dist.z3)
  const z4 = Math.max(0, dist.z4)
  const z5 = Math.max(0, dist.z5)
  const clamped = z1 + z2 + z3 + z4 + z5
  if (clamped === 0) return { z1: 1, z2: 0, z3: 0, z4: 0, z5: 0 }
  return {
    z1: round3(z1 / clamped),
    z2: round3(z2 / clamped),
    z3: round3(z3 / clamped),
    z4: round3(z4 / clamped),
    z5: round3(z5 / clamped),
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the zone intensity distribution for a given week.
 *
 * @param phase            Training phase for the week.
 * @param model            Polarized or pyramidal.
 * @param isRecoveryWeek   Whether this is a planned recovery micro-cycle.
 */
export function getIntensityDistribution(
  phase: PhaseLabel,
  model: IntensityModel,
  isRecoveryWeek: boolean
): ZoneDistribution {
  const base = TABLES[model][phase]
  const dist = isRecoveryWeek ? applyRecoveryShift(base) : { ...base }
  return normalise(dist)
}

/**
 * Convenience: return the fraction of total time in "hard" zones (Z4 + Z5).
 */
export function hardZoneFraction(dist: ZoneDistribution): number {
  return dist.z4 + dist.z5
}

/**
 * Convenience: return the fraction of total time in "easy" zones (Z1 + Z2).
 */
export function easyZoneFraction(dist: ZoneDistribution): number {
  return dist.z1 + dist.z2
}
