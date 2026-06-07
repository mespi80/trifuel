import { describe, it, expect } from 'vitest'
import { riegelPredict, thresholdPaceFromRaceTime, calculateRunZones, formatPace } from './run'

// ── riegelPredict ─────────────────────────────────────────────────────────────

describe('riegelPredict', () => {
  it('throws for invalid knownDistanceM', () => {
    expect(() => riegelPredict(0, 1200, 5000)).toThrow(RangeError)
    expect(() => riegelPredict(-1, 1200, 5000)).toThrow(RangeError)
  })

  it('throws for invalid knownTimeSec', () => {
    expect(() => riegelPredict(5000, 0, 10000)).toThrow(RangeError)
  })

  it('throws for invalid targetDistanceM', () => {
    expect(() => riegelPredict(5000, 1200, 0)).toThrow(RangeError)
  })

  it('returns knownTimeSec when target equals known distance', () => {
    // T₂ = T₁ × (D₂/D₁)^1.06 = T₁ × 1^1.06 = T₁
    expect(riegelPredict(5000, 1200, 5000)).toBeCloseTo(1200, 5)
  })

  it('predicts longer time for longer distance', () => {
    const predicted = riegelPredict(5000, 1200, 10000)
    expect(predicted).toBeGreaterThan(1200)
  })

  it('predicts shorter time for shorter distance', () => {
    const predicted = riegelPredict(5000, 1200, 1500)
    expect(predicted).toBeLessThan(1200)
  })

  it('applies Riegel exponent 1.06 — 5 km 20:00 → 10 km ≈ 41:39', () => {
    // T₂ = 1200 × (10000/5000)^1.06 = 1200 × 2^1.06 ≈ 1200 × 2.085 ≈ 2502 s ≈ 41:42
    const predicted = riegelPredict(5000, 1200, 10000)
    expect(predicted).toBeCloseTo(2501.5, 0)
  })

  it('is consistent: predict A→B then B→A should return approx original time', () => {
    const distA = 5000,
      timeA = 1200
    const distB = 21097
    const timeB = riegelPredict(distA, timeA, distB)
    const backToA = riegelPredict(distB, timeB, distA)
    expect(backToA).toBeCloseTo(timeA, 1)
  })

  it('half-marathon from 10 km — fast runner: 30:00 → ~64:00', () => {
    const predicted = riegelPredict(10000, 1800, 21097)
    // rough range: 63–67 minutes
    expect(predicted).toBeGreaterThan(3780) // 63 min
    expect(predicted).toBeLessThan(4020) // 67 min
  })

  it('marathon from half-marathon: 1:30 → ~3:06–3:15', () => {
    const predicted = riegelPredict(21097, 5400, 42195)
    expect(predicted).toBeGreaterThan(11160) // 186 min = 3:06
    expect(predicted).toBeLessThan(11700) // 195 min = 3:15
  })
})

// ── thresholdPaceFromRaceTime ──────────────────────────────────────────────────

describe('thresholdPaceFromRaceTime', () => {
  it('10 km race maps to approximately the 10 km pace', () => {
    // 10 km in 45:00 = 270 sec/km. Correction factor for 10 km is 1.0.
    const pace = thresholdPaceFromRaceTime(10000, 2700)
    expect(pace).toBeCloseTo(270, 0) // within 1 sec/km
  })

  it('5 km race produces a threshold pace slower than raw 5 km pace', () => {
    // 5 km in 20:00 → raw pace 240 sec/km. Threshold is SLOWER (correction > 1).
    const raw5kPace = 1200 / 5 // 240 sec/km
    const threshold = thresholdPaceFromRaceTime(5000, 1200)
    expect(threshold).toBeGreaterThan(raw5kPace)
  })

  it('marathon race produces a threshold pace faster than marathon pace', () => {
    // Marathon is run well below threshold → threshold faster
    const marathonPace = 14400 / 42.195 // 4:00 marathon → ~341 sec/km
    const threshold = thresholdPaceFromRaceTime(42195, 14400)
    expect(threshold).toBeLessThan(marathonPace)
  })

  it('faster race time → faster threshold pace (same distance)', () => {
    const slow = thresholdPaceFromRaceTime(10000, 3600) // 60 min 10 km
    const fast = thresholdPaceFromRaceTime(10000, 2400) // 40 min 10 km
    expect(fast).toBeLessThan(slow)
  })

  it('returns a positive pace', () => {
    const pace = thresholdPaceFromRaceTime(10000, 2700)
    expect(pace).toBeGreaterThan(0)
  })
})

// ── calculateRunZones ─────────────────────────────────────────────────────────

describe('calculateRunZones', () => {
  const THRESHOLD = 240 // 4:00 /km

  it('throws for threshold ≤ 0', () => {
    expect(() => calculateRunZones(0)).toThrow(RangeError)
    expect(() => calculateRunZones(-1)).toThrow(RangeError)
  })

  it('returns exactly 5 zones', () => {
    expect(Object.keys(calculateRunZones(THRESHOLD))).toHaveLength(5)
  })

  it('all zone keys z1–z5 are present', () => {
    const zones = calculateRunZones(THRESHOLD)
    for (const key of ['z1', 'z2', 'z3', 'z4', 'z5'] as const) {
      expect(zones).toHaveProperty(key)
    }
  })

  it('z5 lower bound is 0 (no practical floor)', () => {
    const { z5 } = calculateRunZones(THRESHOLD)
    expect(z5.min).toBe(0)
  })

  it('z1 upper bound is Infinity (no practical ceiling)', () => {
    const { z1 } = calculateRunZones(THRESHOLD)
    expect(z1.max).toBe(Infinity)
  })

  it('threshold pace falls within z4', () => {
    const zones = calculateRunZones(THRESHOLD)
    expect(THRESHOLD).toBeGreaterThanOrEqual(zones.z4.min)
    expect(THRESHOLD).toBeLessThanOrEqual(zones.z4.max)
  })

  it('zones are ordered by pace — z5 fastest, z1 slowest', () => {
    const zones = calculateRunZones(THRESHOLD)
    // lower sec/km = faster
    expect(zones.z5.min).toBeLessThan(zones.z4.min)
    expect(zones.z4.min).toBeLessThan(zones.z3.min)
    expect(zones.z3.min).toBeLessThan(zones.z2.min)
    expect(zones.z2.min).toBeLessThan(zones.z1.min)
  })

  it('zones are contiguous — z2 max = z1 min', () => {
    const zones = calculateRunZones(THRESHOLD)
    expect(zones.z2.max).toBe(zones.z1.min)
  })

  it('z3 is contiguous with z2 and z4', () => {
    const zones = calculateRunZones(THRESHOLD)
    expect(zones.z3.max).toBe(zones.z2.min)
    expect(zones.z4.max).toBe(zones.z3.min)
  })

  it('all zones have labels', () => {
    const zones = calculateRunZones(THRESHOLD)
    for (const z of Object.values(zones)) {
      expect(typeof z.label).toBe('string')
      expect(z.label.length).toBeGreaterThan(0)
    }
  })

  it('scales proportionally for a different threshold', () => {
    const t2 = 300 // 5:00 /km
    const zonesA = calculateRunZones(THRESHOLD)
    const zonesB = calculateRunZones(t2)
    const ratio = t2 / THRESHOLD // 1.25
    const expected = zonesA.z4.min * ratio
    // Allow ±1 for rounding differences between the two zone calculations
    expect(zonesB.z4.min).toBeGreaterThanOrEqual(Math.floor(expected) - 1)
    expect(zonesB.z4.min).toBeLessThanOrEqual(Math.ceil(expected) + 1)
  })

  it('z4 width spans from 99% to 105% of threshold', () => {
    const zones = calculateRunZones(THRESHOLD)
    expect(zones.z4.min).toBe(Math.round(THRESHOLD * 0.99))
    expect(zones.z4.max).toBe(Math.round(THRESHOLD * 1.05))
  })
})

// ── formatPace ────────────────────────────────────────────────────────────────

describe('formatPace', () => {
  it('formats 240 sec/km as "4:00 /km"', () => {
    expect(formatPace(240)).toBe('4:00 /km')
  })

  it('formats 270 sec/km as "4:30 /km"', () => {
    expect(formatPace(270)).toBe('4:30 /km')
  })

  it('formats Infinity as "∞"', () => {
    expect(formatPace(Infinity)).toBe('∞')
  })

  it('zero-pads seconds', () => {
    expect(formatPace(300)).toBe('5:00 /km')
    expect(formatPace(305)).toBe('5:05 /km')
  })
})
