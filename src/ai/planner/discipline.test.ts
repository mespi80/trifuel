import { describe, it, expect } from 'vitest'
import {
  getDisciplineSplit,
  blendWithPreferences,
  splitToHours,
  normaliseSplit,
} from './discipline'
import type { DisciplineSplit } from './types'

// ── normaliseSplit ────────────────────────────────────────────────────────────

describe('normaliseSplit', () => {
  it('fractions sum to 1 after normalisation', () => {
    const s = normaliseSplit({ swim: 2, bike: 5, run: 3 })
    expect(s.swim + s.bike + s.run).toBeCloseTo(1, 5)
  })

  it('handles equal weights', () => {
    const s = normaliseSplit({ swim: 1, bike: 1, run: 1 })
    // round2 rounds to 2 decimal places, so 1/3 ≈ 0.33
    expect(s.swim).toBeCloseTo(1 / 3, 1)
    expect(s.bike).toBeCloseTo(1 / 3, 1)
    expect(s.run).toBeCloseTo(1 / 3, 1)
  })

  it('clamps negatives to 0', () => {
    const s = normaliseSplit({ swim: -0.1, bike: 0.6, run: 0.5 })
    expect(s.swim).toBe(0)
    expect(s.swim + s.bike + s.run).toBeCloseTo(1, 5)
  })

  it('handles degenerate all-zero — returns equal split', () => {
    const s = normaliseSplit({ swim: 0, bike: 0, run: 0 })
    expect(s.swim + s.bike + s.run).toBeCloseTo(1, 3)
  })
})

// ── getDisciplineSplit ────────────────────────────────────────────────────────

describe('getDisciplineSplit — no preferences', () => {
  it('fractions sum to 1 for all distance × phase combinations', () => {
    for (const dist of ['sprint', 'olympic', 'half_ironman', 'ironman'] as const) {
      for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
        const s = getDisciplineSplit(dist, phase)
        expect(s.swim + s.bike + s.run).toBeCloseTo(1, 4)
      }
    }
  })

  it('ironman base has more bike than run', () => {
    const s = getDisciplineSplit('ironman', 'base')
    expect(s.bike).toBeGreaterThan(s.run)
  })

  it('ironman base has more bike than swim', () => {
    const s = getDisciplineSplit('ironman', 'base')
    expect(s.bike).toBeGreaterThan(s.swim)
  })

  it('sprint peak run fraction ≥ ironman peak run fraction', () => {
    const sprint = getDisciplineSplit('sprint', 'peak')
    const ironman = getDisciplineSplit('ironman', 'peak')
    expect(sprint.run).toBeGreaterThan(ironman.run)
  })

  it('all fractions are > 0', () => {
    const s = getDisciplineSplit('olympic', 'build')
    expect(s.swim).toBeGreaterThan(0)
    expect(s.bike).toBeGreaterThan(0)
    expect(s.run).toBeGreaterThan(0)
  })

  it('swim fraction decreases from base to peak (volume focus shifts)', () => {
    const base = getDisciplineSplit('olympic', 'base')
    const peak = getDisciplineSplit('olympic', 'peak')
    expect(peak.swim).toBeLessThanOrEqual(base.swim)
  })
})

// ── blendWithPreferences ──────────────────────────────────────────────────────

describe('blendWithPreferences', () => {
  const defaultSplit: DisciplineSplit = { swim: 0.2, bike: 0.5, run: 0.3 }

  it('returns clone of default when no preferences provided', () => {
    const s = blendWithPreferences(defaultSplit)
    expect(s.swim).toBeCloseTo(defaultSplit.swim, 5)
    expect(s.bike).toBeCloseTo(defaultSplit.bike, 5)
    expect(s.run).toBeCloseTo(defaultSplit.run, 5)
  })

  it('returns clone of default for empty preferences object', () => {
    const s = blendWithPreferences(defaultSplit, {})
    expect(s.swim + s.bike + s.run).toBeCloseTo(1, 5)
  })

  it('preference toward run increases run fraction', () => {
    const s = blendWithPreferences(defaultSplit, { swim: 1, bike: 1, run: 3 }, 0.5)
    expect(s.run).toBeGreaterThan(defaultSplit.run)
  })

  it('preference toward swim decreases bike fraction', () => {
    const s = blendWithPreferences(defaultSplit, { swim: 5, bike: 1, run: 1 }, 0.5)
    expect(s.swim).toBeGreaterThan(defaultSplit.swim)
    expect(s.bike).toBeLessThan(defaultSplit.bike)
  })

  it('result always sums to 1 regardless of preference weights', () => {
    const s = blendWithPreferences(defaultSplit, { swim: 0, bike: 10, run: 3 }, 0.4)
    expect(s.swim + s.bike + s.run).toBeCloseTo(1, 5)
  })

  it('preferenceWeight = 0 returns exact default', () => {
    const s = blendWithPreferences(defaultSplit, { swim: 0, bike: 0, run: 100 }, 0)
    expect(s.run).toBeCloseTo(defaultSplit.run, 5)
  })

  it('preferenceWeight = 1 returns fully normalised preference', () => {
    const s = blendWithPreferences(defaultSplit, { swim: 1, bike: 0, run: 0 }, 1)
    expect(s.swim).toBeCloseTo(1, 3)
  })
})

// ── splitToHours ──────────────────────────────────────────────────────────────

describe('splitToHours', () => {
  it('hours sum approximately to targetHours (within rounding)', () => {
    const split: DisciplineSplit = { swim: 0.2, bike: 0.52, run: 0.28 }
    const { swim, bike, run } = splitToHours(split, 10)
    expect(swim + bike + run).toBeCloseTo(10, 1)
  })

  it('swim hours = split.swim × targetHours', () => {
    const split: DisciplineSplit = { swim: 0.25, bike: 0.45, run: 0.3 }
    const { swim } = splitToHours(split, 8)
    expect(swim).toBeCloseTo(2, 1)
  })

  it('returns 0 hours when targetHours = 0', () => {
    const split: DisciplineSplit = { swim: 0.25, bike: 0.45, run: 0.3 }
    const { swim, bike, run } = splitToHours(split, 0)
    expect(swim).toBe(0)
    expect(bike).toBe(0)
    expect(run).toBe(0)
  })

  it('all values are non-negative', () => {
    const split: DisciplineSplit = { swim: 0.2, bike: 0.5, run: 0.3 }
    const hrs = splitToHours(split, 12)
    expect(hrs.swim).toBeGreaterThanOrEqual(0)
    expect(hrs.bike).toBeGreaterThanOrEqual(0)
    expect(hrs.run).toBeGreaterThanOrEqual(0)
  })
})
