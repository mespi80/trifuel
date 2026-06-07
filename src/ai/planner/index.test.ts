import { describe, it, expect } from 'vitest'
import { generatePeriodizationPlan } from './index'

// Helper: build a future ISO date N weeks from now
function futureDate(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]!
}

// ── Structural invariants ─────────────────────────────────────────────────────

describe('generatePeriodizationPlan — structure', () => {
  const base = {
    raceDistance: 'olympic' as const,
    raceDate: futureDate(20),
    weeklyHours: 10,
    experienceLevel: 'intermediate' as const,
  }

  it('returns totalWeeks matching weeks array length', () => {
    const plan = generatePeriodizationPlan(base)
    expect(plan.weeks).toHaveLength(plan.totalWeeks)
  })

  it('weeks are numbered 1-based sequentially', () => {
    const plan = generatePeriodizationPlan(base)
    plan.weeks.forEach((w, i) => {
      expect(w.weekNumber).toBe(i + 1)
    })
  })

  it('phase summaries cover all weeks without gaps', () => {
    const plan = generatePeriodizationPlan(base)
    const covered = plan.phases.reduce((sum, p) => sum + p.durationWeeks, 0)
    expect(covered).toBe(plan.totalWeeks)
  })

  it('phase summaries are ordered base → build → peak → taper', () => {
    const plan = generatePeriodizationPlan(base)
    const order = plan.phases.map((p) => p.phase)
    expect(order).toEqual(['base', 'build', 'peak', 'taper'])
  })

  it('all weeks have intensityDistribution summing to 1', () => {
    const plan = generatePeriodizationPlan(base)
    for (const w of plan.weeks) {
      const d = w.intensityDistribution
      expect(d.z1 + d.z2 + d.z3 + d.z4 + d.z5).toBeCloseTo(1, 4)
    }
  })

  it('all weeks have disciplineSplit summing to 1', () => {
    const plan = generatePeriodizationPlan(base)
    for (const w of plan.weeks) {
      const s = w.disciplineSplit
      expect(s.swim + s.bike + s.run).toBeCloseTo(1, 4)
    }
  })

  it('all weeks have positive targetHours', () => {
    const plan = generatePeriodizationPlan(base)
    for (const w of plan.weeks) {
      expect(w.targetHours).toBeGreaterThan(0)
    }
  })

  it('disciplineHours.swim + bike + run ≈ targetHours for each week', () => {
    const plan = generatePeriodizationPlan(base)
    for (const w of plan.weeks) {
      const hrs = w.disciplineHours
      expect(hrs.swim + hrs.bike + hrs.run).toBeCloseTo(w.targetHours, 0)
    }
  })

  it('peakWeekIndex is within bounds', () => {
    const plan = generatePeriodizationPlan(base)
    expect(plan.peakWeekIndex).toBeGreaterThanOrEqual(0)
    expect(plan.peakWeekIndex).toBeLessThan(plan.totalWeeks)
  })

  it('peak week has the highest targetHours in the plan', () => {
    const plan = generatePeriodizationPlan(base)
    const peakHours = plan.weeks[plan.peakWeekIndex]!.targetHours
    for (const w of plan.weeks) {
      expect(w.targetHours).toBeLessThanOrEqual(peakHours + 0.01)
    }
  })

  it('generatedAt is a valid ISO string', () => {
    const plan = generatePeriodizationPlan(base)
    expect(() => new Date(plan.generatedAt)).not.toThrow()
    expect(new Date(plan.generatedAt).getFullYear()).toBeGreaterThan(2020)
  })

  it('isPhaseStart is true for exactly one week per phase', () => {
    const plan = generatePeriodizationPlan(base)
    for (const phase of ['base', 'build', 'peak', 'taper'] as const) {
      const phaseStarts = plan.weeks.filter((w) => w.phase === phase && w.isPhaseStart)
      expect(phaseStarts).toHaveLength(1)
    }
  })
})

// ── Intensity model selection ─────────────────────────────────────────────────

describe('generatePeriodizationPlan — intensity model', () => {
  it('beginner uses polarized model', () => {
    const plan = generatePeriodizationPlan({
      raceDistance: 'sprint',
      raceDate: futureDate(12),
      weeklyHours: 6,
      experienceLevel: 'beginner',
    })
    expect(plan.intensityModel).toBe('polarized')
  })

  it('intermediate uses pyramidal model', () => {
    const plan = generatePeriodizationPlan({
      raceDistance: 'olympic',
      raceDate: futureDate(20),
      weeklyHours: 10,
      experienceLevel: 'intermediate',
    })
    expect(plan.intensityModel).toBe('pyramidal')
  })

  it('elite uses pyramidal model', () => {
    const plan = generatePeriodizationPlan({
      raceDistance: 'ironman',
      raceDate: futureDate(40),
      weeklyHours: 18,
      experienceLevel: 'elite',
    })
    expect(plan.intensityModel).toBe('pyramidal')
  })

  it('beginner base weeks have z3 = 0 (no grey zone)', () => {
    const plan = generatePeriodizationPlan({
      raceDistance: 'sprint',
      raceDate: futureDate(12),
      weeklyHours: 6,
      experienceLevel: 'beginner',
    })
    const baseWeeks = plan.weeks.filter((w) => w.phase === 'base' && !w.isRecoveryWeek)
    for (const w of baseWeeks) {
      expect(w.intensityDistribution.z3).toBe(0)
    }
  })
})

// ── Volume behaviour ──────────────────────────────────────────────────────────

describe('generatePeriodizationPlan — volume', () => {
  const input = {
    raceDistance: 'olympic' as const,
    raceDate: futureDate(24),
    weeklyHours: 12,
    experienceLevel: 'intermediate' as const,
  }

  it('taper weeks have lower volume than build weeks', () => {
    const plan = generatePeriodizationPlan(input)
    const taperHours = plan.weeks.filter((w) => w.phase === 'taper').map((w) => w.targetHours)
    const buildHours = plan.weeks.filter((w) => w.phase === 'build').map((w) => w.targetHours)
    const avgTaper = taperHours.reduce((s, v) => s + v, 0) / taperHours.length
    const avgBuild = buildHours.reduce((s, v) => s + v, 0) / buildHours.length
    expect(avgTaper).toBeLessThan(avgBuild)
  })

  it('recovery weeks have lower hours than surrounding weeks in same phase', () => {
    const plan = generatePeriodizationPlan(input)
    const baseWeeks = plan.weeks.filter((w) => w.phase === 'base')
    const recovery = baseWeeks.filter((w) => w.isRecoveryWeek)
    const normal = baseWeeks.filter((w) => !w.isRecoveryWeek)
    if (recovery.length > 0 && normal.length > 0) {
      const avgRec = recovery.reduce((s, w) => s + w.targetHours, 0) / recovery.length
      const avgNorm = normal.reduce((s, w) => s + w.targetHours, 0) / normal.length
      expect(avgRec).toBeLessThan(avgNorm)
    }
  })

  it('no week exceeds weeklyHours + 5% (volume cap)', () => {
    const plan = generatePeriodizationPlan(input)
    for (const w of plan.weeks) {
      expect(w.targetHours).toBeLessThanOrEqual(input.weeklyHours * 1.05)
    }
  })
})

// ── Discipline preferences ────────────────────────────────────────────────────

describe('generatePeriodizationPlan — discipline preferences', () => {
  it('strong run preference increases run fraction vs default', () => {
    const base = generatePeriodizationPlan({
      raceDistance: 'olympic',
      raceDate: futureDate(20),
      weeklyHours: 10,
      experienceLevel: 'intermediate',
    })
    const withPref = generatePeriodizationPlan({
      raceDistance: 'olympic',
      raceDate: futureDate(20),
      weeklyHours: 10,
      experienceLevel: 'intermediate',
      disciplinePreferences: { swim: 1, bike: 1, run: 5 },
    })

    const avgRunBase = base.weeks.reduce((s, w) => s + w.disciplineSplit.run, 0) / base.weeks.length
    const avgRunPref =
      withPref.weeks.reduce((s, w) => s + w.disciplineSplit.run, 0) / withPref.weeks.length
    expect(avgRunPref).toBeGreaterThan(avgRunBase)
  })
})

// ── weeksAvailable override ───────────────────────────────────────────────────

describe('generatePeriodizationPlan — weeksAvailable override', () => {
  it('uses weeksAvailable when explicitly provided', () => {
    const plan = generatePeriodizationPlan({
      raceDistance: 'olympic',
      raceDate: futureDate(50), // would give ~50 weeks
      weeksAvailable: 16, // but we override to 16
      weeklyHours: 10,
      experienceLevel: 'intermediate',
    })
    expect(plan.totalWeeks).toBe(16)
  })
})
