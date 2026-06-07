import { describe, it, expect } from 'vitest'
import { calculateAge, estimateMaxHr, estimateMaxHrClassic, calculateHrZones } from './hr'

// ── calculateAge ──────────────────────────────────────────────────────────────

describe('calculateAge', () => {
  it('returns correct age for a past birthday this year', () => {
    // Use a fixed birth date 30 years before a known point; since test runs at
    // whatever date, we anchor relative to today.
    const today = new Date()
    const birthYear = today.getFullYear() - 30
    const birthDate = `${birthYear}-01-01`
    // If today is before Jan 1 in the birth year offset, age is 29; otherwise 30.
    const expected =
      today.getMonth() > 0 || (today.getMonth() === 0 && today.getDate() >= 1) ? 30 : 29
    expect(calculateAge(birthDate)).toBe(expected)
  })

  it('returns 0 for a newborn (today)', () => {
    const today = new Date().toISOString().split('T')[0]!
    expect(calculateAge(today)).toBe(0)
  })

  it('accounts for birthday not yet reached this year', () => {
    // Use a fixed future month/day that is reliably in the future relative to Jan 1.
    // Test assumes running after Jan 1 in any given year.
    const today = new Date()
    const birthYear = today.getFullYear() - 25

    // Pick Dec 31 — guaranteed to be in the future unless today IS Dec 31.
    const month = today.getMonth() === 11 && today.getDate() === 31 ? 1 : 12
    const day = today.getMonth() === 11 && today.getDate() === 31 ? 15 : 31

    const birthDate = `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const age = calculateAge(birthDate)
    // Birthday hasn't happened yet this calendar year → age is 24
    expect(age).toBe(24)
  })
})

// ── estimateMaxHr (Tanaka) ─────────────────────────────────────────────────────

describe('estimateMaxHr (Tanaka)', () => {
  it('returns 194 for age 20', () => {
    expect(estimateMaxHr(20)).toBe(194) // 208 - 0.7×20 = 194
  })

  it('returns 187 for age 30', () => {
    expect(estimateMaxHr(30)).toBe(187) // 208 - 0.7×30 = 187
  })

  it('returns 180 for age 40', () => {
    expect(estimateMaxHr(40)).toBe(180) // 208 - 0.7×40 = 180
  })

  it('returns 173 for age 50', () => {
    expect(estimateMaxHr(50)).toBe(173) // 208 - 0.7×50 = 173
  })

  it('decreases as age increases', () => {
    const ages = [20, 30, 40, 50, 60, 70]
    const hrs = ages.map(estimateMaxHr)
    for (let i = 1; i < hrs.length; i++) {
      expect(hrs[i]).toBeLessThan(hrs[i - 1]!)
    }
  })
})

// ── estimateMaxHrClassic ──────────────────────────────────────────────────────

describe('estimateMaxHrClassic (220 − age)', () => {
  it('returns 190 for age 30', () => {
    expect(estimateMaxHrClassic(30)).toBe(190)
  })

  it('returns 180 for age 40', () => {
    expect(estimateMaxHrClassic(40)).toBe(180)
  })

  it('returns 200 for age 20', () => {
    expect(estimateMaxHrClassic(20)).toBe(200)
  })
})

// ── calculateHrZones ──────────────────────────────────────────────────────────

describe('calculateHrZones', () => {
  const MAX_HR = 190

  it('throws for maxHr ≤ 0', () => {
    expect(() => calculateHrZones(0)).toThrow(RangeError)
    expect(() => calculateHrZones(-10)).toThrow(RangeError)
  })

  it('returns exactly 5 zones', () => {
    const zones = calculateHrZones(MAX_HR)
    expect(Object.keys(zones)).toHaveLength(5)
  })

  it('all zone keys are present (z1–z5)', () => {
    const zones = calculateHrZones(MAX_HR)
    for (const key of ['z1', 'z2', 'z3', 'z4', 'z5'] as const) {
      expect(zones).toHaveProperty(key)
    }
  })

  it('z1 min = 50% maxHR', () => {
    const { z1 } = calculateHrZones(MAX_HR)
    expect(z1.min).toBe(Math.round(MAX_HR * 0.5))
  })

  it('z1 max = 60% maxHR', () => {
    const { z1 } = calculateHrZones(MAX_HR)
    expect(z1.max).toBe(Math.round(MAX_HR * 0.6))
  })

  it('z5 max = maxHR (100%)', () => {
    const { z5 } = calculateHrZones(MAX_HR)
    expect(z5.max).toBe(Math.round(MAX_HR * 1.0))
  })

  it('z5 min = 90% maxHR', () => {
    const { z5 } = calculateHrZones(MAX_HR)
    expect(z5.min).toBe(Math.round(MAX_HR * 0.9))
  })

  it('zones are ordered — each zone min > previous zone min', () => {
    const zones = calculateHrZones(MAX_HR)
    const mins = [zones.z1.min, zones.z2.min, zones.z3.min, zones.z4.min, zones.z5.min]
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i]).toBeGreaterThan(mins[i - 1]!)
    }
  })

  it('zones are contiguous — each zone min equals previous zone max', () => {
    const zones = calculateHrZones(MAX_HR)
    expect(zones.z2.min).toBe(zones.z1.max)
    expect(zones.z3.min).toBe(zones.z2.max)
    expect(zones.z4.min).toBe(zones.z3.max)
    expect(zones.z5.min).toBe(zones.z4.max)
  })

  it('all zones have a string label', () => {
    const zones = calculateHrZones(MAX_HR)
    for (const zone of Object.values(zones)) {
      expect(typeof zone.label).toBe('string')
      expect(zone.label.length).toBeGreaterThan(0)
    }
  })

  it('scales correctly for maxHR = 200', () => {
    const { z1, z3, z5 } = calculateHrZones(200)
    expect(z1.min).toBe(100)
    expect(z3.min).toBe(140)
    expect(z5.max).toBe(200)
  })

  it('scales correctly for maxHR = 160 (older athlete)', () => {
    const { z1, z5 } = calculateHrZones(160)
    expect(z1.min).toBe(80)
    expect(z5.max).toBe(160)
  })
})
