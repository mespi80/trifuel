import { describe, it, expect } from 'vitest'
import { calculatePowerZones, ftpFrom20MinPower, wattsPerKg } from './power'

// ── calculatePowerZones ───────────────────────────────────────────────────────

describe('calculatePowerZones', () => {
  const FTP = 200

  it('throws for FTP ≤ 0', () => {
    expect(() => calculatePowerZones(0)).toThrow(RangeError)
    expect(() => calculatePowerZones(-50)).toThrow(RangeError)
  })

  it('returns exactly 7 zones', () => {
    expect(Object.keys(calculatePowerZones(FTP))).toHaveLength(7)
  })

  it('all zone keys z1–z7 are present', () => {
    const zones = calculatePowerZones(FTP)
    for (const key of ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const) {
      expect(zones).toHaveProperty(key)
    }
  })

  it('z1 min = 0 (Active Recovery has no lower bound)', () => {
    const { z1 } = calculatePowerZones(FTP)
    expect(z1.min).toBe(0)
  })

  it('z1 max = 55% FTP', () => {
    const { z1 } = calculatePowerZones(FTP)
    expect(z1.max).toBe(Math.round(FTP * 0.55))
  })

  it('z2 spans 55–75% FTP', () => {
    const { z2 } = calculatePowerZones(FTP)
    expect(z2.min).toBe(Math.round(FTP * 0.55))
    expect(z2.max).toBe(Math.round(FTP * 0.75))
  })

  it('z3 spans 76–90% FTP', () => {
    const { z3 } = calculatePowerZones(FTP)
    expect(z3.min).toBe(Math.round(FTP * 0.76))
    expect(z3.max).toBe(Math.round(FTP * 0.9))
  })

  it('z4 (Lactate Threshold) spans 91–105% FTP', () => {
    const { z4 } = calculatePowerZones(FTP)
    expect(z4.min).toBe(Math.round(FTP * 0.91))
    expect(z4.max).toBe(Math.round(FTP * 1.05))
  })

  it('FTP value falls within z4', () => {
    const zones = calculatePowerZones(FTP)
    expect(FTP).toBeGreaterThanOrEqual(zones.z4.min)
    expect(FTP).toBeLessThanOrEqual(zones.z4.max)
  })

  it('z5 spans 106–120% FTP', () => {
    const { z5 } = calculatePowerZones(FTP)
    expect(z5.min).toBe(Math.round(FTP * 1.06))
    expect(z5.max).toBe(Math.round(FTP * 1.2))
  })

  it('z6 spans 121–150% FTP', () => {
    const { z6 } = calculatePowerZones(FTP)
    expect(z6.min).toBe(Math.round(FTP * 1.21))
    expect(z6.max).toBe(Math.round(FTP * 1.5))
  })

  it('z7 lower bound = 151% FTP', () => {
    const { z7 } = calculatePowerZones(FTP)
    expect(z7.min).toBe(Math.round(FTP * 1.51))
  })

  it('z7 upper bound is Infinity', () => {
    const { z7 } = calculatePowerZones(FTP)
    expect(z7.max).toBe(Infinity)
  })

  it('zones are strictly ordered by wattage', () => {
    const zones = calculatePowerZones(FTP)
    const mins = [
      zones.z1.min,
      zones.z2.min,
      zones.z3.min,
      zones.z4.min,
      zones.z5.min,
      zones.z6.min,
      zones.z7.min,
    ]
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i]).toBeGreaterThan(mins[i - 1]!)
    }
  })

  it('all zones have string labels', () => {
    const zones = calculatePowerZones(FTP)
    for (const z of Object.values(zones)) {
      expect(typeof z.label).toBe('string')
      expect(z.label.length).toBeGreaterThan(0)
    }
  })

  it('scales correctly for FTP = 300 W', () => {
    const { z4 } = calculatePowerZones(300)
    expect(z4.min).toBe(Math.round(300 * 0.91)) // 273 W
    expect(z4.max).toBe(Math.round(300 * 1.05)) // 315 W
  })

  it('scales correctly for FTP = 150 W (beginner)', () => {
    const zones = calculatePowerZones(150)
    expect(zones.z2.min).toBe(Math.round(150 * 0.55)) // 83 W
    expect(zones.z7.min).toBe(Math.round(150 * 1.51)) // 227 W
  })
})

// ── ftpFrom20MinPower ─────────────────────────────────────────────────────────

describe('ftpFrom20MinPower', () => {
  it('throws for avgPower ≤ 0', () => {
    expect(() => ftpFrom20MinPower(0)).toThrow(RangeError)
    expect(() => ftpFrom20MinPower(-10)).toThrow(RangeError)
  })

  it('returns 95% of 20-min power', () => {
    expect(ftpFrom20MinPower(250)).toBe(Math.round(250 * 0.95)) // 237 W
  })

  it('returns 190 for 20-min power of 200 W', () => {
    expect(ftpFrom20MinPower(200)).toBe(190)
  })

  it('returns a positive integer', () => {
    const result = ftpFrom20MinPower(300)
    expect(result).toBeGreaterThan(0)
    expect(Number.isInteger(result)).toBe(true)
  })
})

// ── wattsPerKg ────────────────────────────────────────────────────────────────

describe('wattsPerKg', () => {
  it('throws for bodyWeight ≤ 0', () => {
    expect(() => wattsPerKg(200, 0)).toThrow(RangeError)
    expect(() => wattsPerKg(200, -5)).toThrow(RangeError)
  })

  it('returns 4.0 for FTP 280 / 70 kg', () => {
    expect(wattsPerKg(280, 70)).toBeCloseTo(4.0, 1)
  })

  it('returns correct w/kg for FTP 200 / 80 kg', () => {
    expect(wattsPerKg(200, 80)).toBeCloseTo(2.5, 2)
  })

  it('higher FTP → higher w/kg (same weight)', () => {
    expect(wattsPerKg(300, 70)).toBeGreaterThan(wattsPerKg(200, 70))
  })

  it('heavier rider → lower w/kg (same FTP)', () => {
    expect(wattsPerKg(200, 90)).toBeLessThan(wattsPerKg(200, 70))
  })
})
