/**
 * Cycling power training zones — Coggan 7-zone model.
 *
 * Zones are defined as percentages of Functional Threshold Power (FTP):
 *
 *   Z1 — Active Recovery:     < 55 %
 *   Z2 — Endurance:         55–75 %
 *   Z3 — Tempo:             76–90 %
 *   Z4 — Lactate Threshold: 91–105 %
 *   Z5 — VO₂max:           106–120 %
 *   Z6 — Anaerobic Capacity:121–150 %
 *   Z7 — Neuromuscular:     > 150 %
 *
 * All values are in watts.  Open upper bound of Z7 is `Infinity`.
 * Open lower bound of Z1 is `0`.
 *
 * Reference: Coggan, A.R., Training and Racing with a Power Meter (2nd ed.).
 */

export interface PowerZoneResult {
  /** Lower boundary in watts (inclusive); 0 for Z1. */
  min: number
  /** Upper boundary in watts (inclusive); Infinity for Z7. */
  max: number
  label: string
}

export type PowerZones = Record<'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'z7', PowerZoneResult>

// [minPct, maxPct, label]
// 0    = no lower limit (Z1)
// Infinity = no upper limit (Z7)
const COGGAN_THRESHOLDS: ReadonlyArray<[number, number, string]> = [
  [0, 0.55, 'Active Recovery'],
  [0.55, 0.75, 'Endurance'],
  [0.76, 0.9, 'Tempo'],
  [0.91, 1.05, 'Lactate Threshold'],
  [1.06, 1.2, 'VO₂max'],
  [1.21, 1.5, 'Anaerobic Capacity'],
  [1.51, Infinity, 'Neuromuscular Power'],
]

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const

/**
 * Return 7 cycling power zones for a given FTP.
 *
 * @param ftp  Functional Threshold Power in watts.
 */
export function calculatePowerZones(ftp: number): PowerZones {
  if (ftp <= 0) throw new RangeError(`FTP must be > 0, got ${ftp}`)

  const result = {} as PowerZones

  COGGAN_THRESHOLDS.forEach(([lo, hi, label], i) => {
    const key = ZONE_KEYS[i]!
    result[key] = {
      min: lo === 0 ? 0 : Math.round(ftp * lo),
      max: hi === Infinity ? Infinity : Math.round(ftp * hi),
      label,
    }
  })

  return result
}

/**
 * Estimate a rough FTP from a 20-minute maximal effort.
 * FTP ≈ 95 % of best 20-minute average power.
 */
export function ftpFrom20MinPower(avgPowerWatts: number): number {
  if (avgPowerWatts <= 0) throw new RangeError('avgPowerWatts must be > 0')
  return Math.round(avgPowerWatts * 0.95)
}

/**
 * Watts per kilogram for a given FTP and body weight.
 */
export function wattsPerKg(ftp: number, bodyWeightKg: number): number {
  if (bodyWeightKg <= 0) throw new RangeError('bodyWeightKg must be > 0')
  return ftp / bodyWeightKg
}
