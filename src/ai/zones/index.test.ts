import { describe, it, expect } from 'vitest'
import { calculateAthleteZones } from './index'

// ── Full athlete (all disciplines) ────────────────────────────────────────────

describe('calculateAthleteZones — full profile', () => {
  const fullInput = {
    birthDate: '1990-01-01',
    maxHrBpm: 185,
    ftp: 250,
    thresholdPaceSecPerKm: 240, // 4:00 /km
    css200mSeconds: 160,
    css400mSeconds: 330,
  }

  it('returns hr, run, power, swim when all data provided', () => {
    const zones = calculateAthleteZones(fullInput)
    expect(zones.hr).toBeDefined()
    expect(zones.run).toBeDefined()
    expect(zones.power).toBeDefined()
    expect(zones.swim).toBeDefined()
  })

  it('meta.maxHrBpm matches supplied value', () => {
    const zones = calculateAthleteZones(fullInput)
    expect(zones.meta.maxHrBpm).toBe(185)
    expect(zones.meta.maxHrEstimated).toBe(false)
  })

  it('meta.thresholdPaceSecPerKm matches supplied value', () => {
    const zones = calculateAthleteZones(fullInput)
    expect(zones.meta.thresholdPaceSecPerKm).toBe(240)
  })

  it('meta.cssPaceSecPer100m is calculated from TT times', () => {
    const zones = calculateAthleteZones(fullInput)
    // CSS = (330 - 160) / 2 = 85 sec/100m
    expect(zones.meta.cssPaceSecPer100m).toBeCloseTo(85, 0)
  })

  it('meta.age is a positive integer', () => {
    const { meta } = calculateAthleteZones(fullInput)
    expect(meta.age).toBeGreaterThan(0)
    expect(Number.isInteger(meta.age)).toBe(true)
  })
})

// ── HR zones — age-based fallback ─────────────────────────────────────────────

describe('calculateAthleteZones — HR estimation', () => {
  it('estimates maxHR from age when maxHrBpm not supplied', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01' })
    expect(zones.meta.maxHrEstimated).toBe(true)
    // Tanaka: 208 - 0.7 × 35 ≈ 184
    expect(zones.meta.maxHrBpm).toBeGreaterThan(150)
    expect(zones.meta.maxHrBpm).toBeLessThan(220)
  })

  it('uses supplied maxHrBpm and marks maxHrEstimated = false', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01', maxHrBpm: 192 })
    expect(zones.meta.maxHrEstimated).toBe(false)
    expect(zones.meta.maxHrBpm).toBe(192)
  })

  it('HR zones are always present even with minimal input', () => {
    const zones = calculateAthleteZones({ birthDate: '1985-03-15' })
    expect(zones.hr).toBeDefined()
    expect(Object.keys(zones.hr)).toHaveLength(5)
  })
})

// ── Run zones — raceTime fallback ─────────────────────────────────────────────

describe('calculateAthleteZones — run zone derivation', () => {
  it('run zones absent when no pace/race data', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01' })
    expect(zones.run).toBeUndefined()
    expect(zones.meta.thresholdPaceSecPerKm).toBeUndefined()
  })

  it('derives run zones from raceTime when thresholdPace not supplied', () => {
    const zones = calculateAthleteZones({
      birthDate: '1990-01-01',
      raceTime: { distanceM: 10000, timeSeconds: 2700 }, // 10 km in 45:00
    })
    expect(zones.run).toBeDefined()
    expect(zones.meta.thresholdPaceSecPerKm).toBeGreaterThan(0)
  })

  it('thresholdPaceSecPerKm takes precedence over raceTime', () => {
    const zones = calculateAthleteZones({
      birthDate: '1990-01-01',
      thresholdPaceSecPerKm: 240,
      raceTime: { distanceM: 5000, timeSeconds: 1200 },
    })
    expect(zones.meta.thresholdPaceSecPerKm).toBe(240)
  })

  it('threshold pace falls in run z4', () => {
    const threshold = 250
    const zones = calculateAthleteZones({
      birthDate: '1990-01-01',
      thresholdPaceSecPerKm: threshold,
    })
    const z4 = zones.run!.z4
    expect(threshold).toBeGreaterThanOrEqual(z4.min)
    expect(threshold).toBeLessThanOrEqual(z4.max)
  })
})

// ── Cycling zones ─────────────────────────────────────────────────────────────

describe('calculateAthleteZones — power zones', () => {
  it('power absent when no FTP supplied', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01' })
    expect(zones.power).toBeUndefined()
  })

  it('power present when FTP supplied', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01', ftp: 220 })
    expect(zones.power).toBeDefined()
    expect(Object.keys(zones.power!)).toHaveLength(7)
  })

  it('FTP falls within power z4', () => {
    const ftp = 220
    const zones = calculateAthleteZones({ birthDate: '1990-01-01', ftp })
    const z4 = zones.power!.z4
    expect(ftp).toBeGreaterThanOrEqual(z4.min)
    expect(ftp).toBeLessThanOrEqual(z4.max)
  })
})

// ── Swimming zones ─────────────────────────────────────────────────────────────

describe('calculateAthleteZones — swim zones', () => {
  it('swim absent when TT times not supplied', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01' })
    expect(zones.swim).toBeUndefined()
  })

  it('swim absent when only 200m time supplied', () => {
    const zones = calculateAthleteZones({ birthDate: '1990-01-01', css200mSeconds: 180 })
    expect(zones.swim).toBeUndefined()
  })

  it('swim present when both TT times supplied', () => {
    const zones = calculateAthleteZones({
      birthDate: '1990-01-01',
      css200mSeconds: 175,
      css400mSeconds: 375,
    })
    expect(zones.swim).toBeDefined()
    expect(Object.keys(zones.swim!)).toHaveLength(5)
  })

  it('CSS pace falls within swim z4', () => {
    const css200 = 175,
      css400 = 375
    const css = (css400 - css200) / 2 // 100 sec/100m
    const zones = calculateAthleteZones({
      birthDate: '1990-01-01',
      css200mSeconds: css200,
      css400mSeconds: css400,
    })
    const z4 = zones.swim!.z4
    expect(css).toBeGreaterThanOrEqual(z4.min)
    expect(css).toBeLessThanOrEqual(z4.max)
  })
})
