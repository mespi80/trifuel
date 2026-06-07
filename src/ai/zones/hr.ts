/**
 * Heart-rate training zones — 5-zone model
 *
 * Zones are defined as percentages of maximum heart rate:
 *   Z1 (Recovery):    50–60 %
 *   Z2 (Aerobic):     60–70 %
 *   Z3 (Tempo):       70–80 %
 *   Z4 (Threshold):   80–90 %
 *   Z5 (VO₂max):      90–100 %
 *
 * If a tested max-HR is not supplied, it is estimated with the
 * Tanaka formula (208 − 0.7 × age), which has lower error than
 * the classic 220 − age for adults.  The simpler 220 − age is
 * also exported for callers that need it explicitly.
 */

export interface HrZoneResult {
  min: number // beats per minute, inclusive
  max: number // beats per minute, inclusive
  label: string
}

export type HrZones = Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5', HrZoneResult>

// ── Age helpers ───────────────────────────────────────────────────────────────

/**
 * Calculate age in whole years from an ISO-8601 date string.
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

/**
 * Classic formula (220 − age).  Lower accuracy than Tanaka but widely
 * recognised in coaching literature.
 */
export function estimateMaxHrClassic(age: number): number {
  return Math.round(220 - age)
}

/**
 * Tanaka et al. (2001) formula: 208 − 0.7 × age.
 * Recommended default — better fit across adult age ranges.
 */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

// ── Zone calculator ───────────────────────────────────────────────────────────

const HR_ZONE_THRESHOLDS: ReadonlyArray<[number, number, string]> = [
  //  [lowerPct, upperPct, label]
  [0.5, 0.6, 'Recovery'],
  [0.6, 0.7, 'Aerobic Base'],
  [0.7, 0.8, 'Tempo'],
  [0.8, 0.9, 'Lactate Threshold'],
  [0.9, 1.0, 'VO₂max'],
]

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5'] as const

/**
 * Return 5 HR training zones for a given maximum heart rate.
 *
 * @param maxHr  Tested or estimated maximum heart rate (bpm).
 */
export function calculateHrZones(maxHr: number): HrZones {
  if (maxHr <= 0) throw new RangeError(`maxHr must be > 0, got ${maxHr}`)

  const result = {} as HrZones

  HR_ZONE_THRESHOLDS.forEach(([lo, hi, label], i) => {
    const key = ZONE_KEYS[i]!
    result[key] = {
      min: Math.round(maxHr * lo),
      max: Math.round(maxHr * hi),
      label,
    }
  })

  return result
}
