/**
 * Training zone calculator — main entry point.
 *
 * Accepts an athlete profile and returns all applicable training zones
 * across the four disciplines supported by TriFuel:
 *   • Heart rate  (always present; estimated from age when no maxHR supplied)
 *   • Running     (present when thresholdPaceSecPerKm or raceTime supplied)
 *   • Cycling     (present when ftp supplied)
 *   • Swimming    (present when both css200mSeconds and css400mSeconds supplied)
 */

import { calculateAge, estimateMaxHr, calculateHrZones, type HrZones } from './hr'
import { thresholdPaceFromRaceTime, calculateRunZones, type RunZones } from './run'
import { calculatePowerZones, type PowerZones } from './power'
import { calculateCss, calculateSwimZones, type SwimZones } from './swim'

// ── Input ─────────────────────────────────────────────────────────────────────

export interface AthleteZoneInput {
  /** ISO-8601 date string, e.g. "1990-06-15". Required — used to estimate maxHR. */
  birthDate: string

  /** Tested maximum heart rate (bpm).  When supplied, overrides age-based estimate. */
  maxHrBpm?: number

  /** Functional Threshold Power (watts). Required for cycling zones. */
  ftp?: number

  /**
   * Lactate-threshold running pace in seconds per kilometre.
   * Takes precedence over raceTime when both are provided.
   */
  thresholdPaceSecPerKm?: number

  /**
   * Recent race result used to derive threshold pace via the Riegel formula.
   * Ignored when thresholdPaceSecPerKm is already supplied.
   */
  raceTime?: {
    distanceM: number // race distance in metres  (e.g. 10000 for 10 km)
    timeSeconds: number // finish time in seconds
  }

  /** 200 m time-trial time in seconds.  Both 200 m and 400 m are required for CSS. */
  css200mSeconds?: number
  /** 400 m time-trial time in seconds. */
  css400mSeconds?: number
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface AthleteZones {
  /** 5-zone HR model.  Always present. */
  hr: HrZones

  /** 5-zone running pace model.  Present when pace data is available. */
  run?: RunZones

  /** Coggan 7-zone power model.  Present when FTP is supplied. */
  power?: PowerZones

  /** 5-zone CSS swim model.  Present when 200 m and 400 m TT times are supplied. */
  swim?: SwimZones

  /** Derived metadata — useful for display / debugging. */
  meta: {
    /** Maximum heart rate used (bpm). */
    maxHrBpm: number
    /** True when maxHR was estimated from age (not tested). */
    maxHrEstimated: boolean
    /** Age in whole years at time of calculation. */
    age: number
    /** Threshold running pace (sec/km) if run zones were calculated. */
    thresholdPaceSecPerKm?: number
    /** Critical Swim Speed (sec/100 m) if swim zones were calculated. */
    cssPaceSecPer100m?: number
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Calculate all applicable training zones for an athlete.
 *
 * @param input  Athlete profile data — see {@link AthleteZoneInput}.
 * @returns      Zone sets for each available discipline.
 */
export function calculateAthleteZones(input: AthleteZoneInput): AthleteZones {
  const age = calculateAge(input.birthDate)

  // ── Heart rate ──────────────────────────────────────────────────────────────
  const maxHrEstimated = input.maxHrBpm === undefined || input.maxHrBpm <= 0
  const maxHrBpm = maxHrEstimated ? estimateMaxHr(age) : input.maxHrBpm!

  const hr = calculateHrZones(maxHrBpm)

  // ── Running ─────────────────────────────────────────────────────────────────
  let run: RunZones | undefined
  let thresholdPaceSecPerKm: number | undefined

  if (input.thresholdPaceSecPerKm && input.thresholdPaceSecPerKm > 0) {
    thresholdPaceSecPerKm = input.thresholdPaceSecPerKm
    run = calculateRunZones(thresholdPaceSecPerKm)
  } else if (input.raceTime && input.raceTime.distanceM > 0 && input.raceTime.timeSeconds > 0) {
    thresholdPaceSecPerKm = thresholdPaceFromRaceTime(
      input.raceTime.distanceM,
      input.raceTime.timeSeconds
    )
    run = calculateRunZones(thresholdPaceSecPerKm)
  }

  // ── Cycling ─────────────────────────────────────────────────────────────────
  const power = input.ftp && input.ftp > 0 ? calculatePowerZones(input.ftp) : undefined

  // ── Swimming ─────────────────────────────────────────────────────────────────
  let swim: SwimZones | undefined
  let cssPaceSecPer100m: number | undefined

  if (
    input.css200mSeconds &&
    input.css400mSeconds &&
    input.css200mSeconds > 0 &&
    input.css400mSeconds > input.css200mSeconds
  ) {
    cssPaceSecPer100m = calculateCss(input.css200mSeconds, input.css400mSeconds)
    swim = calculateSwimZones(cssPaceSecPer100m)
  }

  return {
    hr,
    run,
    power,
    swim,
    meta: {
      maxHrBpm,
      maxHrEstimated,
      age,
      thresholdPaceSecPerKm,
      cssPaceSecPer100m,
    },
  }
}

// Re-export individual calculators and utilities for direct use
export { calculateAge, estimateMaxHr, calculateHrZones, type HrZones } from './hr'

export {
  riegelPredict,
  thresholdPaceFromRaceTime,
  calculateRunZones,
  formatPace,
  type RunZones,
} from './run'

export { calculatePowerZones, ftpFrom20MinPower, wattsPerKg, type PowerZones } from './power'

export { calculateCss, calculateSwimZones, formatSwimPace, type SwimZones } from './swim'
