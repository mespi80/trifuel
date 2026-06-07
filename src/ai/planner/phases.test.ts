import { describe, it, expect } from 'vitest'
import {
  allocatePhases,
  buildPhaseSequence,
  weeksUntilRace,
  TAPER_WEEKS,
  PHASE_DESCRIPTIONS,
} from './phases'

// ── TAPER_WEEKS ────────────────────────────────────────────────────────────────

describe('TAPER_WEEKS', () => {
  it('sprint taper is 1 week', () => {
    expect(TAPER_WEEKS.sprint).toBe(1)
  })

  it('olympic taper is 2 weeks', () => {
    expect(TAPER_WEEKS.olympic).toBe(2)
  })

  it('half_ironman taper is 2 weeks', () => {
    expect(TAPER_WEEKS.half_ironman).toBe(2)
  })

  it('ironman taper is 3 weeks', () => {
    expect(TAPER_WEEKS.ironman).toBe(3)
  })
})

// ── weeksUntilRace ─────────────────────────────────────────────────────────────

describe('weeksUntilRace', () => {
  it('returns at least 1 for any future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    expect(weeksUntilRace(future.toISOString().split('T')[0]!)).toBeGreaterThanOrEqual(1)
  })

  it('returns at least 1 for a past date (graceful floor)', () => {
    expect(weeksUntilRace('2000-01-01')).toBe(1)
  })

  it('returns approximately correct weeks for 12 weeks ahead', () => {
    const target = new Date()
    target.setDate(target.getDate() + 84) // 12 × 7 = 84
    const w = weeksUntilRace(target.toISOString().split('T')[0]!)
    expect(w).toBeGreaterThanOrEqual(11)
    expect(w).toBeLessThanOrEqual(13)
  })

  it('returns integer weeks', () => {
    const future = new Date()
    future.setDate(future.getDate() + 100)
    const w = weeksUntilRace(future.toISOString().split('T')[0]!)
    expect(Number.isInteger(w)).toBe(true)
  })
})

// ── allocatePhases ────────────────────────────────────────────────────────────

describe('allocatePhases — invariants', () => {
  it('sum of all phases equals totalWeeks', () => {
    const result = allocatePhases(20, 'olympic', 'intermediate')
    expect(result.base + result.build + result.peak + result.taper).toBe(20)
  })

  it('handles short build-up (8 weeks, sprint)', () => {
    const result = allocatePhases(8, 'sprint', 'beginner')
    expect(result.base + result.build + result.peak + result.taper).toBe(8)
    expect(result.taper).toBe(TAPER_WEEKS.sprint)
  })

  it('handles long build (40 weeks, ironman)', () => {
    const result = allocatePhases(40, 'ironman', 'advanced')
    expect(result.base + result.build + result.peak + result.taper).toBe(40)
    expect(result.taper).toBe(TAPER_WEEKS.ironman)
  })

  it('all phases ≥ 1 week', () => {
    for (const dist of ['sprint', 'olympic', 'half_ironman', 'ironman'] as const) {
      for (const lvl of ['beginner', 'intermediate', 'advanced', 'elite'] as const) {
        const r = allocatePhases(12, dist, lvl)
        expect(r.base).toBeGreaterThanOrEqual(1)
        expect(r.build).toBeGreaterThanOrEqual(1)
        expect(r.peak).toBeGreaterThanOrEqual(1)
        expect(r.taper).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('ironman has the longest taper', () => {
    const sprint = allocatePhases(24, 'sprint', 'intermediate')
    const ironman = allocatePhases(24, 'ironman', 'intermediate')
    expect(ironman.taper).toBeGreaterThan(sprint.taper)
  })

  it('base is the largest phase for ironman', () => {
    const r = allocatePhases(24, 'ironman', 'beginner')
    expect(r.base).toBeGreaterThanOrEqual(r.build)
    expect(r.base).toBeGreaterThanOrEqual(r.peak)
  })

  it('advanced athletes get smaller base ratio than beginners (same distance, weeks)', () => {
    const beginner = allocatePhases(20, 'olympic', 'beginner')
    const advanced = allocatePhases(20, 'olympic', 'advanced')
    expect(advanced.base).toBeLessThanOrEqual(beginner.base)
  })

  it('taper is fixed regardless of experience level', () => {
    const beg = allocatePhases(20, 'olympic', 'beginner')
    const eli = allocatePhases(20, 'olympic', 'elite')
    expect(beg.taper).toBe(eli.taper)
  })

  it('config.taperWeeks matches the taper phase weeks', () => {
    const r = allocatePhases(16, 'half_ironman', 'intermediate')
    expect(r.config.taperWeeks).toBe(r.taper)
  })

  it('works correctly for total = 5 (near-minimal plan)', () => {
    // 4 weeks is pathological for sprint (taper=1, minimums base=2, build=1, peak=1 → 5 needed).
    // Test 5 weeks which is the true floor for sprint.
    const r = allocatePhases(5, 'sprint', 'beginner')
    expect(r.base + r.build + r.peak + r.taper).toBe(5)
  })
})

// ── buildPhaseSequence ────────────────────────────────────────────────────────

describe('buildPhaseSequence', () => {
  it('returns array with correct length', () => {
    const seq = buildPhaseSequence(4, 3, 2, 1)
    expect(seq).toHaveLength(10)
  })

  it('phases appear in correct order: base → build → peak → taper', () => {
    const seq = buildPhaseSequence(3, 2, 2, 1)
    expect(seq.slice(0, 3)).toEqual(['base', 'base', 'base'])
    expect(seq.slice(3, 5)).toEqual(['build', 'build'])
    expect(seq.slice(5, 7)).toEqual(['peak', 'peak'])
    expect(seq[7]).toBe('taper')
  })

  it('each phase count is exact', () => {
    const seq = buildPhaseSequence(5, 4, 3, 2)
    expect(seq.filter((p) => p === 'base').length).toBe(5)
    expect(seq.filter((p) => p === 'build').length).toBe(4)
    expect(seq.filter((p) => p === 'peak').length).toBe(3)
    expect(seq.filter((p) => p === 'taper').length).toBe(2)
  })
})

// ── PHASE_DESCRIPTIONS ────────────────────────────────────────────────────────

describe('PHASE_DESCRIPTIONS', () => {
  it('all four phases have non-empty descriptions', () => {
    for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
      expect(PHASE_DESCRIPTIONS[phase].length).toBeGreaterThan(10)
    }
  })
})
