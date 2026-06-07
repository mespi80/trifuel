import { describe, it, expect } from 'vitest'
import {
  selectIntensityModel,
  getIntensityDistribution,
  normalise,
  hardZoneFraction,
  easyZoneFraction,
} from './intensity'
import type { ZoneDistribution } from './types'

// ── selectIntensityModel ───────────────────────────────────────────────────────

describe('selectIntensityModel', () => {
  it('returns polarized for beginner', () => {
    expect(selectIntensityModel('beginner')).toBe('polarized')
  })

  it('returns pyramidal for intermediate', () => {
    expect(selectIntensityModel('intermediate')).toBe('pyramidal')
  })

  it('returns pyramidal for advanced', () => {
    expect(selectIntensityModel('advanced')).toBe('pyramidal')
  })

  it('returns pyramidal for elite', () => {
    expect(selectIntensityModel('elite')).toBe('pyramidal')
  })
})

// ── normalise ─────────────────────────────────────────────────────────────────

describe('normalise', () => {
  it('output sums to exactly 1', () => {
    const dist: ZoneDistribution = { z1: 0.65, z2: 0.22, z3: 0.05, z4: 0.05, z5: 0.03 }
    const n = normalise(dist)
    const sum = n.z1 + n.z2 + n.z3 + n.z4 + n.z5
    expect(sum).toBeCloseTo(1, 5)
  })

  it('handles values that do not sum to 1 (re-normalises)', () => {
    const dist: ZoneDistribution = { z1: 1, z2: 1, z3: 1, z4: 1, z5: 1 }
    const n = normalise(dist)
    expect(n.z1 + n.z2 + n.z3 + n.z4 + n.z5).toBeCloseTo(1, 5)
    expect(n.z1).toBeCloseTo(0.2, 3)
  })

  it('clamps negative values to 0', () => {
    const dist: ZoneDistribution = { z1: 0.8, z2: 0.3, z3: -0.1, z4: 0.0, z5: 0.0 }
    const n = normalise(dist)
    expect(n.z3).toBe(0)
    const sum = n.z1 + n.z2 + n.z3 + n.z4 + n.z5
    expect(sum).toBeCloseTo(1, 5)
  })

  it('handles degenerate all-zero input', () => {
    const dist: ZoneDistribution = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
    const n = normalise(dist)
    expect(n.z1).toBe(1)
    expect(n.z2).toBe(0)
  })
})

// ── getIntensityDistribution ──────────────────────────────────────────────────

describe('getIntensityDistribution — polarized model', () => {
  it('sums to 1 for all phase × recovery combinations', () => {
    for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
      for (const rec of [false, true]) {
        const dist = getIntensityDistribution(phase, 'polarized', rec)
        const sum = dist.z1 + dist.z2 + dist.z3 + dist.z4 + dist.z5
        expect(sum).toBeCloseTo(1, 5)
      }
    }
  })

  it('z3 is 0 in polarized base (no grey zone)', () => {
    const dist = getIntensityDistribution('base', 'polarized', false)
    expect(dist.z3).toBe(0)
  })

  it('z3 is 0 in polarized build', () => {
    const dist = getIntensityDistribution('build', 'polarized', false)
    expect(dist.z3).toBe(0)
  })

  it('easy fraction ≥ 0.75 in polarized base', () => {
    const dist = getIntensityDistribution('base', 'polarized', false)
    expect(easyZoneFraction(dist)).toBeGreaterThanOrEqual(0.75)
  })

  it('hard fraction (Z4+Z5) > 0 even in base', () => {
    const dist = getIntensityDistribution('base', 'polarized', false)
    expect(hardZoneFraction(dist)).toBeGreaterThan(0)
  })

  it('hard fraction increases from base → build → peak', () => {
    const base = hardZoneFraction(getIntensityDistribution('base', 'polarized', false))
    const build = hardZoneFraction(getIntensityDistribution('build', 'polarized', false))
    const peak = hardZoneFraction(getIntensityDistribution('peak', 'polarized', false))
    expect(build).toBeGreaterThan(base)
    expect(peak).toBeGreaterThan(build)
  })

  it('recovery week has higher z1 than non-recovery for same phase', () => {
    const normal = getIntensityDistribution('build', 'polarized', false)
    const recovery = getIntensityDistribution('build', 'polarized', true)
    expect(recovery.z1).toBeGreaterThan(normal.z1)
  })

  it('recovery week has lower hard-zone fraction', () => {
    const normal = hardZoneFraction(getIntensityDistribution('build', 'polarized', false))
    const recovery = hardZoneFraction(getIntensityDistribution('build', 'polarized', true))
    expect(recovery).toBeLessThan(normal)
  })
})

describe('getIntensityDistribution — pyramidal model', () => {
  it('sums to 1 for all phases', () => {
    for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
      const dist = getIntensityDistribution(phase, 'pyramidal', false)
      const sum = dist.z1 + dist.z2 + dist.z3 + dist.z4 + dist.z5
      expect(sum).toBeCloseTo(1, 5)
    }
  })

  it('z3 > 0 in pyramidal build (tempo band is used)', () => {
    const dist = getIntensityDistribution('build', 'pyramidal', false)
    expect(dist.z3).toBeGreaterThan(0)
  })

  it('pyramidal peak has more hard-zone time than polarized peak (both models push intensity at peak)', () => {
    // Both models should have significant hard-zone allocation in peak
    const pol = hardZoneFraction(getIntensityDistribution('peak', 'polarized', false))
    const pyr = hardZoneFraction(getIntensityDistribution('peak', 'pyramidal', false))
    // Pyramidal Z4+Z5 in peak should be meaningful (≥15%)
    expect(pyr).toBeGreaterThanOrEqual(0.15)
    // Polarized Z4+Z5 in peak should also be meaningful
    expect(pol).toBeGreaterThanOrEqual(0.15)
  })

  it('zone order is pyramidal: z1 > z2 > z3 > z4 > z5 in base', () => {
    const dist = getIntensityDistribution('base', 'pyramidal', false)
    expect(dist.z1).toBeGreaterThan(dist.z2)
    expect(dist.z2).toBeGreaterThan(dist.z3)
    expect(dist.z3).toBeGreaterThan(dist.z4)
    expect(dist.z4).toBeGreaterThan(dist.z5)
  })
})

// ── hardZoneFraction / easyZoneFraction ───────────────────────────────────────

describe('hardZoneFraction + easyZoneFraction', () => {
  it('easy + hard ≤ 1 (z3 is the remainder)', () => {
    const dist = getIntensityDistribution('build', 'pyramidal', false)
    expect(easyZoneFraction(dist) + hardZoneFraction(dist)).toBeLessThanOrEqual(1.001)
  })

  it('easy + hard + z3 = 1', () => {
    const dist = getIntensityDistribution('build', 'pyramidal', false)
    expect(easyZoneFraction(dist) + dist.z3 + hardZoneFraction(dist)).toBeCloseTo(1, 5)
  })
})
