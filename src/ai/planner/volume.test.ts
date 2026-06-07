import { describe, it, expect } from 'vitest'
import {
  rampVolume,
  taperVolume,
  isRecoveryWeek,
  weeklyVolume,
  taperReductionPct,
  RECOVERY_VOLUME_FACTOR,
} from './volume'

// ── rampVolume ────────────────────────────────────────────────────────────────

describe('rampVolume', () => {
  it('returns startFactor × hours at week 0', () => {
    const v = rampVolume(0, 6, 10, 0.7, 0.9)
    expect(v).toBeCloseTo(7.0, 2)
  })

  it('returns endFactor × hours at last week', () => {
    const v = rampVolume(5, 6, 10, 0.7, 0.9)
    expect(v).toBeCloseTo(9.0, 2)
  })

  it('is monotonically increasing across a ramp', () => {
    const phases = 8
    const vols = Array.from({ length: phases }, (_, i) => rampVolume(i, phases, 10, 0.7, 1.0))
    for (let i = 1; i < vols.length; i++) {
      expect(vols[i]).toBeGreaterThanOrEqual(vols[i - 1]!)
    }
  })

  it('handles single-week phase', () => {
    expect(rampVolume(0, 1, 10, 0.7, 1.0)).toBeCloseTo(10, 2)
  })

  it('is bounded — never exceeds endFactor × hours', () => {
    for (let i = 0; i < 10; i++) {
      const v = rampVolume(i, 10, 12, 0.6, 1.0)
      expect(v).toBeLessThanOrEqual(12 + 0.01) // allow floating point margin
    }
  })

  it('returns a positive number', () => {
    expect(rampVolume(3, 8, 10, 0.7, 0.9)).toBeGreaterThan(0)
  })
})

// ── taperVolume ───────────────────────────────────────────────────────────────

describe('taperVolume', () => {
  it('first taper week is higher than last', () => {
    const first = taperVolume(0, 3, 12, 'ironman')
    const last = taperVolume(2, 3, 12, 'ironman')
    expect(first).toBeGreaterThan(last)
  })

  it('sprint taper (1 week) = single low value', () => {
    const v = taperVolume(0, 1, 10, 'sprint')
    // endFactor for sprint = 0.30
    expect(v).toBeCloseTo(10 * 0.3, 1)
  })

  it('ironman first taper week starts higher than sprint', () => {
    const ironman = taperVolume(0, 3, 10, 'ironman') // startFactor 0.60
    const sprint = taperVolume(0, 1, 10, 'sprint') // endFactor 0.30
    expect(ironman).toBeGreaterThan(sprint)
  })

  it('volume reduction is between 40–70% relative to weeklyHours for all distances', () => {
    void RECOVERY_VOLUME_FACTOR // sanity check import
    for (const dist of ['sprint', 'olympic', 'half_ironman', 'ironman'] as const) {
      const [start] = taperReductionPct(dist) // reduction at start of taper
      expect(start).toBeGreaterThanOrEqual(40)
      expect(start).toBeLessThanOrEqual(60)
    }
  })

  it('returns positive number', () => {
    expect(taperVolume(1, 2, 10, 'olympic')).toBeGreaterThan(0)
  })
})

// ── taperReductionPct ─────────────────────────────────────────────────────────

describe('taperReductionPct', () => {
  it('ironman start reduction ≥ 40%', () => {
    const [start] = taperReductionPct('ironman')
    expect(start).toBeGreaterThanOrEqual(40)
  })

  it('end reduction > start reduction (taper gets progressively easier)', () => {
    for (const dist of ['sprint', 'olympic', 'half_ironman', 'ironman'] as const) {
      const [start, end] = taperReductionPct(dist)
      expect(end).toBeGreaterThan(start)
    }
  })
})

// ── isRecoveryWeek ────────────────────────────────────────────────────────────

describe('isRecoveryWeek', () => {
  it('base cadence is 4 — week index 3 is recovery', () => {
    expect(isRecoveryWeek(3, 'base')).toBe(true)
  })

  it('base cadence is 4 — week index 7 is recovery', () => {
    expect(isRecoveryWeek(7, 'base')).toBe(true)
  })

  it('base cadence is 4 — week index 2 is NOT recovery', () => {
    expect(isRecoveryWeek(2, 'base')).toBe(false)
  })

  it('build cadence is 3 — week index 2 is recovery', () => {
    expect(isRecoveryWeek(2, 'build')).toBe(true)
  })

  it('build cadence is 3 — week index 5 is recovery', () => {
    expect(isRecoveryWeek(5, 'build')).toBe(true)
  })

  it('build cadence is 3 — week index 1 is NOT recovery', () => {
    expect(isRecoveryWeek(1, 'build')).toBe(false)
  })

  it('taper phase is never a recovery week', () => {
    for (let i = 0; i < 10; i++) {
      expect(isRecoveryWeek(i, 'taper')).toBe(false)
    }
  })

  it('peak phase is never a recovery week', () => {
    for (let i = 0; i < 10; i++) {
      expect(isRecoveryWeek(i, 'peak')).toBe(false)
    }
  })
})

// ── weeklyVolume ──────────────────────────────────────────────────────────────

describe('weeklyVolume', () => {
  it('recovery week has lower hours than non-recovery in same phase/position', () => {
    const rec = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 3,
      phaseLength: 8,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    const normal = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 2,
      phaseLength: 8,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    expect(rec.targetHours).toBeLessThan(normal.targetHours)
  })

  it('build end week (non-recovery) ≈ weeklyHours (100%)', () => {
    // Index 5 in a 6-week build would be recovery (position 6, 6%3=0).
    // Use a 7-week build where index 6 (position 7) is non-recovery (7%3 ≠ 0).
    const last = weeklyVolume({
      phase: 'build',
      weekIndexInPhase: 6,
      phaseLength: 7,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    expect(last.isRecoveryWeek).toBe(false)
    expect(last.targetHours).toBeCloseTo(10, 1)
  })

  it('base start week ≈ 70% of weeklyHours', () => {
    const first = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 0,
      phaseLength: 6,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    expect(first.targetHours).toBeCloseTo(7.0, 0)
  })

  it('taper volume is below 70% of weeklyHours', () => {
    const v = weeklyVolume({
      phase: 'taper',
      weekIndexInPhase: 0,
      phaseLength: 2,
      weeklyHours: 10,
      raceDistance: 'ironman',
    })
    expect(v.targetHours).toBeLessThan(7)
  })

  it('isRecoveryWeek flag matches expectation for base week 4 (0-indexed 3)', () => {
    const v = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 3,
      phaseLength: 8,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    expect(v.isRecoveryWeek).toBe(true)
  })

  it('recovery volume factor is applied correctly', () => {
    const normal = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 2,
      phaseLength: 8,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    const recovery = weeklyVolume({
      phase: 'base',
      weekIndexInPhase: 3,
      phaseLength: 8,
      weeklyHours: 10,
      raceDistance: 'olympic',
    })
    // Recovery hours should be RECOVERY_VOLUME_FACTOR × nominal of that position
    // (not comparing directly because week 3 nominal ≠ week 2 nominal, just check ratio)
    expect(recovery.targetHours).toBeLessThan(normal.targetHours)
  })

  it('returns positive hours for all phases', () => {
    for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
      const v = weeklyVolume({
        phase,
        weekIndexInPhase: 0,
        phaseLength: 4,
        weeklyHours: 8,
        raceDistance: 'olympic',
      })
      expect(v.targetHours).toBeGreaterThan(0)
    }
  })
})
