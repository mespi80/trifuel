/**
 * Swimming pace zones — Critical Swim Speed (CSS) model.
 *
 * Critical Swim Speed is the maximum pace that can be sustained aerobically
 * without accumulating blood lactate — analogous to lactate threshold on land.
 *
 * CSS is derived from two timed time-trials (400 m and 200 m):
 *
 *   CSS (m/sec) = (400 − 200) / (T₄₀₀ − T₂₀₀)
 *              = 200 / (T₄₀₀ − T₂₀₀)
 *
 * Expressed as pace: CSS (sec / 100 m) = 100 / CSS_m_per_sec
 *                                      = (T₄₀₀ − T₂₀₀) / 2
 *
 * Zone boundaries (multipliers of CSS pace in sec/100 m):
 *   Z1 (Easy / Recovery):   CSS × 1.25 and above  →  [CSS×1.25, ∞)
 *   Z2 (Aerobic Base):      CSS × 1.10 – 1.25      →  [CSS×1.10, CSS×1.25)
 *   Z3 (Tempo):             CSS × 1.03 – 1.10      →  [CSS×1.03, CSS×1.10)
 *   Z4 (CSS / Threshold):   CSS × 0.97 – 1.03      →  [CSS×0.97, CSS×1.03)
 *   Z5 (Race / Sprint):     < CSS × 0.97            →  [0,        CSS×0.97)
 *
 * As with running, pace = sec/100 m; **lower number = faster**.
 * Open upper bound of Z1 is `Infinity`; open lower bound of Z5 is `0`.
 *
 * Reference: Pyne, D.B., Lee, H., Swanwick, K.M. (2001). Monitoring the
 * lactate threshold in world-ranked swimmers. Medicine & Science in Sports
 * & Exercise, 33(2), 291-297.
 */

export interface SwimZoneResult {
  /** Fastest pace in zone (sec/100 m); lower number = faster. */
  min: number
  /** Slowest pace in zone (sec/100 m); Infinity for Z1. */
  max: number
  label: string
}

export type SwimZones = Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5', SwimZoneResult>

// ── CSS calculation ────────────────────────────────────────────────────────────

/**
 * Calculate Critical Swim Speed (sec/100 m) from 200 m and 400 m time-trial
 * results.
 *
 * @param time200mSec  200 m time-trial time in seconds.
 * @param time400mSec  400 m time-trial time in seconds.
 * @returns CSS pace in seconds per 100 m.
 * @throws RangeError if times are invalid or T400 ≤ T200.
 */
export function calculateCss(time200mSec: number, time400mSec: number): number {
  if (time200mSec <= 0) throw new RangeError('time200mSec must be > 0')
  if (time400mSec <= 0) throw new RangeError('time400mSec must be > 0')
  if (time400mSec <= time200mSec) {
    throw new RangeError('time400mSec must be greater than time200mSec')
  }

  // CSS in m/sec = 200 / (T400 - T200)
  const cssMPerSec = 200 / (time400mSec - time200mSec)
  // Convert to sec/100m
  return 100 / cssMPerSec
}

// ── Zone boundaries ────────────────────────────────────────────────────────────

const SWIM_ZONE_THRESHOLDS: ReadonlyArray<[number, number, string]> = [
  //  [min multiplier, max multiplier, label]
  //  Higher multiplier = slower pace (more sec/100 m)
  [1.25, Infinity, 'Easy / Recovery'],
  [1.1, 1.25, 'Aerobic Base'],
  [1.03, 1.1, 'Tempo'],
  [0.97, 1.03, 'CSS / Threshold'],
  [0.0, 0.97, 'Race / Sprint'],
]

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5'] as const

/**
 * Return 5 swim pace zones from a CSS pace.
 *
 * @param cssPaceSecPer100m  Critical Swim Speed in seconds per 100 m.
 */
export function calculateSwimZones(cssPaceSecPer100m: number): SwimZones {
  if (cssPaceSecPer100m <= 0) {
    throw new RangeError(`cssPaceSecPer100m must be > 0, got ${cssPaceSecPer100m}`)
  }

  const result = {} as SwimZones

  SWIM_ZONE_THRESHOLDS.forEach(([loMult, hiMult, label], i) => {
    const key = ZONE_KEYS[i]!
    result[key] = {
      min: loMult === 0 ? 0 : Math.round(cssPaceSecPer100m * loMult * 10) / 10,
      max: hiMult === Infinity ? Infinity : Math.round(cssPaceSecPer100m * hiMult * 10) / 10,
      label,
    }
  })

  return result
}

// ── Utility ────────────────────────────────────────────────────────────────────

/**
 * Format a swim pace (sec/100 m) as "M:SS /100 m".
 * Returns "∞" for Infinity.
 */
export function formatSwimPace(secPer100m: number): string {
  if (!isFinite(secPer100m)) return '∞'
  const mins = Math.floor(secPer100m / 60)
  const secs = Math.round(secPer100m % 60)
  return `${mins}:${String(secs).padStart(2, '0')} /100m`
}
