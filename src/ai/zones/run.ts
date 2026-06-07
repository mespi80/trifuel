/**
 * Running pace training zones — 5-zone model anchored at lactate-threshold pace.
 *
 * All pace values are expressed as **seconds per kilometre** (lower = faster).
 *
 * Zone boundaries (multipliers of threshold pace):
 *   Z1 (Recovery):   > 129 %  →  [thresholdPace × 1.29,  ∞)
 *   Z2 (Aerobic):    114–129 % →  [thresholdPace × 1.14,  thresholdPace × 1.29)
 *   Z3 (Tempo):      105–114 % →  [thresholdPace × 1.05,  thresholdPace × 1.14)
 *   Z4 (Threshold):   99–105 % →  [thresholdPace × 0.99,  thresholdPace × 1.05)
 *   Z5 (VO₂max+):    <  99 %  →  [0,                      thresholdPace × 0.99)
 *
 * The open upper bound of Z1 is represented as `Infinity` so callers can
 * apply their own display logic (e.g. "≥ 8:36 /km").
 *
 * Riegel formula (1977) is used to convert a known race result to any
 * target distance:   T₂ = T₁ × (D₂ / D₁) ^ 1.06
 *
 * Threshold pace derivation from a race result:
 *   1. Predict 10 km time via Riegel (10 km ≈ lactate-threshold race distance).
 *   2. Apply a small empirical correction based on the source distance to
 *      compensate for Riegel's slight over-prediction at shorter distances.
 */

export interface RunZoneResult {
  /** Fastest pace in zone (sec/km); lower bound — may be 0 for Z5. */
  min: number
  /** Slowest pace in zone (sec/km); upper bound — may be Infinity for Z1. */
  max: number
  label: string
}

export type RunZones = Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5', RunZoneResult>

// ── Riegel formula ─────────────────────────────────────────────────────────────

/**
 * Predict the finish time for `targetDistanceM` given a known result.
 *
 * @param knownDistanceM  Distance of the known race (metres).
 * @param knownTimeSec    Finish time of the known race (seconds).
 * @param targetDistanceM Distance of the target race (metres).
 * @returns Predicted finish time in seconds.
 */
export function riegelPredict(
  knownDistanceM: number,
  knownTimeSec: number,
  targetDistanceM: number
): number {
  if (knownDistanceM <= 0) throw new RangeError('knownDistanceM must be > 0')
  if (knownTimeSec <= 0) throw new RangeError('knownTimeSec must be > 0')
  if (targetDistanceM <= 0) throw new RangeError('targetDistanceM must be > 0')

  return knownTimeSec * Math.pow(targetDistanceM / knownDistanceM, 1.06)
}

/**
 * Empirical correction factors that adjust the Riegel-predicted 10 km time
 * toward a more accurate threshold-pace estimate depending on the source
 * race distance.
 *
 * 10 km already represents ~60 min effort for club runners, so its factor is 1.
 * Shorter races run faster than threshold → factor > 1 (pace slower than race).
 * Longer races run slower than threshold → factor < 1 (pace faster than Riegel 10 K).
 */
const THRESHOLD_CORRECTION: Record<string, number> = {
  '1500': 1.08,
  '3000': 1.07,
  '5000': 1.055,
  '10000': 1.0,
  '21097': 0.975, // half-marathon
  '42195': 0.94, // marathon
}

function correctionFor(distanceM: number): number {
  const buckets = Object.entries(THRESHOLD_CORRECTION)
    .map(([d, f]) => ({ d: Number(d), f }))
    .sort((a, b) => a.d - b.d)

  // find closest bucket
  let best = buckets[0]!
  let bestDiff = Math.abs(distanceM - best.d)
  for (const b of buckets) {
    const diff = Math.abs(distanceM - b.d)
    if (diff < bestDiff) {
      bestDiff = diff
      best = b
    }
  }
  return best.f
}

/**
 * Derive lactate-threshold pace (sec/km) from a recent race result using
 * the Riegel formula with distance-specific correction.
 */
export function thresholdPaceFromRaceTime(distanceM: number, timeSec: number): number {
  const tenKTimeSec = riegelPredict(distanceM, timeSec, 10_000)
  const correction = correctionFor(distanceM)
  // threshold pace = corrected 10 km pace
  return (tenKTimeSec * correction) / 10 // sec/km
}

// ── Zone boundaries ────────────────────────────────────────────────────────────

/** Zone multiplier pairs: [minMultiplier, maxMultiplier].
 *  Pace = threshold × multiplier; higher multiplier = slower. */
const RUN_ZONE_THRESHOLDS: ReadonlyArray<[number, number, string]> = [
  //  [lower pace multiplier, upper pace multiplier, label]
  //  Z1 — slowest, no upper limit
  [1.29, Infinity, 'Recovery'],
  [1.14, 1.29, 'Aerobic Base'],
  [1.05, 1.14, 'Tempo'],
  [0.99, 1.05, 'Lactate Threshold'],
  [0.0, 0.99, 'VO₂max / Speed'], // no practical lower limit
]

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5'] as const

/**
 * Return 5 running pace zones from a lactate-threshold pace.
 *
 * @param thresholdPaceSecPerKm  Threshold pace in seconds per kilometre.
 */
export function calculateRunZones(thresholdPaceSecPerKm: number): RunZones {
  if (thresholdPaceSecPerKm <= 0) {
    throw new RangeError(`thresholdPaceSecPerKm must be > 0, got ${thresholdPaceSecPerKm}`)
  }

  const result = {} as RunZones

  RUN_ZONE_THRESHOLDS.forEach(([loMult, hiMult, label], i) => {
    const key = ZONE_KEYS[i]!
    result[key] = {
      // min = fastest pace in zone (lower seconds/km value)
      min: loMult === 0 ? 0 : Math.round(thresholdPaceSecPerKm * loMult),
      // max = slowest pace in zone
      max: hiMult === Infinity ? Infinity : Math.round(thresholdPaceSecPerKm * hiMult),
      label,
    }
  })

  return result
}

// ── Utility ────────────────────────────────────────────────────────────────────

/**
 * Format a pace value (sec/km) as "M:SS /km".
 * Returns "∞" for Infinity.
 */
export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm)) return '∞'
  const mins = Math.floor(secPerKm / 60)
  const secs = Math.round(secPerKm % 60)
  return `${mins}:${String(secs).padStart(2, '0')} /km`
}
