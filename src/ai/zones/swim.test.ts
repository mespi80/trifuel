import { describe, it, expect } from 'vitest'
import { calculateCss, calculateSwimZones, formatSwimPace } from './swim'

// ── calculateCss ──────────────────────────────────────────────────────────────

describe('calculateCss', () => {
  it('throws when time200m ≤ 0', () => {
    expect(() => calculateCss(0, 390)).toThrow(RangeError)
    expect(() => calculateCss(-10, 390)).toThrow(RangeError)
  })

  it('throws when time400m ≤ 0', () => {
    expect(() => calculateCss(180, 0)).toThrow(RangeError)
  })

  it('throws when time400m ≤ time200m', () => {
    expect(() => calculateCss(200, 200)).toThrow(RangeError)
    expect(() => calculateCss(200, 180)).toThrow(RangeError)
  })

  it('computes CSS correctly: T200=180, T400=390 → CSS=95 sec/100m', () => {
    // CSS = (T400 - T200) / 2 = (390 - 180) / 2 = 105 sec/100m
    expect(calculateCss(180, 390)).toBeCloseTo(105, 1)
  })

  it('computes CSS for typical club swimmer: T200=3:00, T400=6:30', () => {
    // T200=180s, T400=390s → CSS = (390-180)/2 = 105 sec/100m = 1:45/100m
    const css = calculateCss(180, 390)
    expect(css).toBeCloseTo(105, 0)
  })

  it('computes CSS for faster swimmer: T200=2:20, T400=5:00', () => {
    // T200=140s, T400=300s → CSS = (300-140)/2 = 80 sec/100m = 1:20/100m
    const css = calculateCss(140, 300)
    expect(css).toBeCloseTo(80, 0)
  })

  it('shorter gap between 200m and 400m → faster CSS pace', () => {
    // Larger aerobic capacity = smaller spread between distances
    const cssA = calculateCss(180, 380) // gap = 200 s → CSS = 100
    const cssB = calculateCss(180, 420) // gap = 240 s → CSS = 120
    expect(cssA).toBeLessThan(cssB)
  })

  it('CSS formula: (T400 - T200) / 2', () => {
    const t200 = 160,
      t400 = 340
    expect(calculateCss(t200, t400)).toBeCloseTo((t400 - t200) / 2, 5)
  })

  it('returns a positive value', () => {
    expect(calculateCss(150, 320)).toBeGreaterThan(0)
  })

  it('elite swimmer: T200=1:50, T400=3:55 → CSS ~52.5 sec/100m', () => {
    // T200=110s, T400=235s → CSS = (235-110)/2 = 62.5
    const css = calculateCss(110, 235)
    expect(css).toBeCloseTo(62.5, 1)
  })
})

// ── calculateSwimZones ────────────────────────────────────────────────────────

describe('calculateSwimZones', () => {
  const CSS = 100 // 1:40 /100m — round number for easy arithmetic

  it('throws for CSS ≤ 0', () => {
    expect(() => calculateSwimZones(0)).toThrow(RangeError)
    expect(() => calculateSwimZones(-1)).toThrow(RangeError)
  })

  it('returns exactly 5 zones', () => {
    expect(Object.keys(calculateSwimZones(CSS))).toHaveLength(5)
  })

  it('all zone keys z1–z5 are present', () => {
    const zones = calculateSwimZones(CSS)
    for (const key of ['z1', 'z2', 'z3', 'z4', 'z5'] as const) {
      expect(zones).toHaveProperty(key)
    }
  })

  it('z1 upper bound is Infinity', () => {
    const { z1 } = calculateSwimZones(CSS)
    expect(z1.max).toBe(Infinity)
  })

  it('z5 lower bound is 0', () => {
    const { z5 } = calculateSwimZones(CSS)
    expect(z5.min).toBe(0)
  })

  it('CSS pace falls within z4', () => {
    const zones = calculateSwimZones(CSS)
    expect(CSS).toBeGreaterThanOrEqual(zones.z4.min)
    expect(CSS).toBeLessThanOrEqual(zones.z4.max)
  })

  it('z1 lower bound = CSS × 1.25 (slowest zone start)', () => {
    const { z1 } = calculateSwimZones(CSS)
    expect(z1.min).toBeCloseTo(CSS * 1.25, 0)
  })

  it('z5 upper bound = CSS × 0.97 (fastest-zone ceiling)', () => {
    const { z5 } = calculateSwimZones(CSS)
    expect(z5.max).toBeCloseTo(CSS * 0.97, 0)
  })

  it('zones are ordered — z5 fastest, z1 slowest (lower sec/100m = faster)', () => {
    const zones = calculateSwimZones(CSS)
    // Adjacent zones share a boundary; each zone's max ≤ next zone's min.
    expect(zones.z5.max).toBeLessThanOrEqual(zones.z4.min)
    expect(zones.z4.max).toBeLessThanOrEqual(zones.z3.min)
    expect(zones.z3.max).toBeLessThanOrEqual(zones.z2.min)
    expect(zones.z2.max).toBeLessThanOrEqual(zones.z1.min)
    // And z5 is strictly faster than z1
    expect(zones.z5.max).toBeLessThan(zones.z1.min)
  })

  it('all zones have string labels', () => {
    const zones = calculateSwimZones(CSS)
    for (const z of Object.values(zones)) {
      expect(typeof z.label).toBe('string')
      expect(z.label.length).toBeGreaterThan(0)
    }
  })

  it('scales proportionally for a faster CSS', () => {
    const fastCss = 75 // 1:15/100m (elite swimmer)
    const zones = calculateSwimZones(fastCss)
    expect(zones.z4.min).toBeCloseTo(fastCss * 0.97, 0)
    expect(zones.z4.max).toBeCloseTo(fastCss * 1.03, 0)
  })

  it('CSS = 105 → z4 range ≈ 101.9–108.2 sec/100m', () => {
    const zones = calculateSwimZones(105)
    expect(zones.z4.min).toBeCloseTo(105 * 0.97, 0) // ≈ 101.9
    expect(zones.z4.max).toBeCloseTo(105 * 1.03, 0) // ≈ 108.2
  })
})

// ── formatSwimPace ────────────────────────────────────────────────────────────

describe('formatSwimPace', () => {
  it('formats 100 sec/100m as "1:40 /100m"', () => {
    expect(formatSwimPace(100)).toBe('1:40 /100m')
  })

  it('formats 90 sec/100m as "1:30 /100m"', () => {
    expect(formatSwimPace(90)).toBe('1:30 /100m')
  })

  it('formats Infinity as "∞"', () => {
    expect(formatSwimPace(Infinity)).toBe('∞')
  })

  it('zero-pads seconds', () => {
    expect(formatSwimPace(65)).toBe('1:05 /100m')
  })

  it('handles sub-minute pace', () => {
    expect(formatSwimPace(55)).toBe('0:55 /100m')
  })
})
