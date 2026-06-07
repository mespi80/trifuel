import { describe, it, expect } from 'vitest'
import {
  replan,
  classifySession,
  detectFatigue,
  detectOverperformance,
  shiftIntensityDown,
  shiftIntensityUp,
  type AthleteContext,
  type CompletedSession,
} from './replan'
import type { GeneratedSession, ZoneKey, DayKey } from './session-generator'
import type { ZoneDistribution } from './types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<GeneratedSession> = {}): GeneratedSession {
  return {
    day: 'wed',
    dayIndex: 2,
    discipline: 'run',
    durationMinutes: 45,
    primaryZone: 'z2',
    isHardSession: false,
    isBrick: false,
    objective: { en: 'Easy run', es: 'Carrera suave' },
    ...overrides,
  }
}

const baseDist: ZoneDistribution = { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 }

function makeCtx(overrides: Partial<AthleteContext> = {}): AthleteContext {
  const currentWeekSessions: GeneratedSession[] = [
    makeSession({ day: 'mon', dayIndex: 0, discipline: 'swim' }),
    makeSession({
      day: 'tue',
      dayIndex: 1,
      discipline: 'bike',
      durationMinutes: 90,
      primaryZone: 'z2',
    }),
    makeSession({ day: 'wed', dayIndex: 2, discipline: 'run' }),
    makeSession({ day: 'thu', dayIndex: 3, discipline: 'rest', durationMinutes: 0 }),
    makeSession({
      day: 'fri',
      dayIndex: 4,
      discipline: 'bike',
      durationMinutes: 60,
      isHardSession: true,
      primaryZone: 'z4',
    }),
    makeSession({ day: 'sat', dayIndex: 5, discipline: 'bike', durationMinutes: 120 }),
    makeSession({ day: 'sun', dayIndex: 6, discipline: 'run', durationMinutes: 60 }),
  ]
  return {
    experienceLevel: 'intermediate',
    raceDistance: 'olympic',
    phase: 'build',
    disciplineSplit: { swim: 0.22, bike: 0.5, run: 0.28 },
    intensityDistribution: baseDist,
    weeklyHours: 10,
    availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    currentWeekSessions,
    nextWeekHours: 10,
    nextWeekAvailableDays: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'],
    nextWeekSessions: [],
    weekStartDate: '2025-06-02',
    ...overrides,
  }
}

// ── classifySession ───────────────────────────────────────────────────────────

describe('classifySession', () => {
  it('rest session is secondary', () => {
    expect(classifySession(makeSession({ discipline: 'rest', durationMinutes: 0 }))).toBe(
      'secondary'
    )
  })

  it('active_recovery session is secondary', () => {
    expect(
      classifySession(makeSession({ discipline: 'active_recovery', durationMinutes: 30 }))
    ).toBe('secondary')
  })

  it('brick session is always key', () => {
    expect(classifySession(makeSession({ isBrick: true, discipline: 'brick' }))).toBe('key')
  })

  it('hard Z4 bike session is key', () => {
    expect(
      classifySession(makeSession({ discipline: 'bike', isHardSession: true, primaryZone: 'z4' }))
    ).toBe('key')
  })

  it('hard Z5 run session is key', () => {
    expect(
      classifySession(makeSession({ discipline: 'run', isHardSession: true, primaryZone: 'z5' }))
    ).toBe('key')
  })

  it('long bike ≥ 90 min is key', () => {
    expect(classifySession(makeSession({ discipline: 'bike', durationMinutes: 90 }))).toBe('key')
  })

  it('long bike 89 min is secondary', () => {
    expect(classifySession(makeSession({ discipline: 'bike', durationMinutes: 89 }))).toBe(
      'secondary'
    )
  })

  it('long run ≥ 60 min is key', () => {
    expect(classifySession(makeSession({ discipline: 'run', durationMinutes: 60 }))).toBe('key')
  })

  it('short easy run 30 min is secondary', () => {
    expect(
      classifySession(makeSession({ discipline: 'run', durationMinutes: 30, isHardSession: false }))
    ).toBe('secondary')
  })

  it('easy swim (Z2, not hard) is secondary', () => {
    expect(
      classifySession(
        makeSession({ discipline: 'swim', isHardSession: false, durationMinutes: 45 })
      )
    ).toBe('secondary')
  })
})

// ── detectFatigue ─────────────────────────────────────────────────────────────

describe('detectFatigue', () => {
  it('returns none when fewer than 3 RPE values', () => {
    const r = detectFatigue({ type: 'fatigue_signal', recentRpe: [8, 8] })
    expect(r.detected).toBe(false)
    expect(r.reason).toBe('none')
  })

  it('detects RPE fatigue when average ≥ 7 over last 3 sessions', () => {
    const r = detectFatigue({ type: 'fatigue_signal', recentRpe: [7, 8, 7] })
    expect(r.detected).toBe(true)
    expect(r.reason).toBe('rpe')
  })

  it('does not detect when RPE average is 6.9', () => {
    const r = detectFatigue({ type: 'fatigue_signal', recentRpe: [6, 7, 7] })
    // avg = 6.67 — below threshold
    expect(r.detected).toBe(false)
  })

  it('detects HRV fatigue when drop ≥ 10%', () => {
    const r = detectFatigue({
      type: 'fatigue_signal',
      recentRpe: [5, 5],
      hrvBaseline: 60,
      currentHrv: 54,
    })
    // drop = 6/60 = 10%
    expect(r.detected).toBe(true)
    expect(r.reason).toBe('hrv')
  })

  it('does not detect HRV fatigue when drop < 10%', () => {
    const r = detectFatigue({
      type: 'fatigue_signal',
      recentRpe: [5, 5],
      hrvBaseline: 60,
      currentHrv: 55,
    })
    // drop = 5/60 ≈ 8.3% — below threshold
    expect(r.detected).toBe(false)
  })

  it('severity is moderate when both RPE and HRV triggered', () => {
    const r = detectFatigue({
      type: 'fatigue_signal',
      recentRpe: [8, 8, 8],
      hrvBaseline: 60,
      currentHrv: 50,
    })
    expect(r.severity).toBe('moderate')
    expect(r.reason).toBe('both')
  })

  it('severity is mild for single signal', () => {
    const r = detectFatigue({ type: 'fatigue_signal', recentRpe: [7, 7, 7] })
    expect(r.severity).toBe('mild')
  })
})

// ── detectOverperformance ─────────────────────────────────────────────────────

describe('detectOverperformance', () => {
  it('returns false when fewer than 3 sessions', () => {
    const r = detectOverperformance([])
    expect(r.detected).toBe(false)
  })

  it('detects when 3 sessions all exceed planned duration by ≥10%', () => {
    const planned = makeSession({ durationMinutes: 60 })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 67, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 68, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 70, actualPrimaryZone: 'z2' },
    ]
    const r = detectOverperformance(sessions)
    expect(r.detected).toBe(true)
    expect(r.durationOverperformers).toBe(3)
  })

  it('detects when 3 sessions all achieve higher zone', () => {
    const planned = makeSession({ primaryZone: 'z2' })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z3' },
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z3' },
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z4' },
    ]
    const r = detectOverperformance(sessions)
    expect(r.detected).toBe(true)
    expect(r.zoneOverperformers).toBe(3)
  })

  it('does not detect when only 2 of 3 sessions exceed duration', () => {
    const planned = makeSession({ durationMinutes: 60 })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 67, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 68, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 59, actualPrimaryZone: 'z2' }, // under
    ]
    const r = detectOverperformance(sessions)
    expect(r.detected).toBe(false)
  })
})

// ── shiftIntensityDown / Up ───────────────────────────────────────────────────

describe('shiftIntensityDown', () => {
  it('reduces z4+z5 and increases z1', () => {
    const shifted = shiftIntensityDown(baseDist, 0.05)
    expect(shifted.z4 + shifted.z5).toBeLessThan(baseDist.z4 + baseDist.z5)
    expect(shifted.z1).toBeGreaterThan(baseDist.z1)
  })

  it('output sums to 1', () => {
    const s = shiftIntensityDown(baseDist, 0.07)
    expect(s.z1 + s.z2 + s.z3 + s.z4 + s.z5).toBeCloseTo(1, 4)
  })

  it('never produces negative zone fractions', () => {
    const extreme = shiftIntensityDown({ z1: 0.9, z2: 0.1, z3: 0, z4: 0, z5: 0 }, 0.05)
    for (const v of Object.values(extreme)) expect(v).toBeGreaterThanOrEqual(0)
  })
})

describe('shiftIntensityUp', () => {
  it('increases z4 and decreases z1', () => {
    const shifted = shiftIntensityUp(baseDist, 0.03)
    expect(shifted.z4).toBeGreaterThan(baseDist.z4)
    expect(shifted.z1).toBeLessThan(baseDist.z1)
  })

  it('output sums to 1', () => {
    const s = shiftIntensityUp(baseDist, 0.03)
    expect(s.z1 + s.z2 + s.z3 + s.z4 + s.z5).toBeCloseTo(1, 4)
  })

  it('never exceeds z5 = 1.0', () => {
    const s = shiftIntensityUp({ z1: 0, z2: 0, z3: 0, z4: 0.5, z5: 0.5 }, 0.1)
    expect(s.z5).toBeLessThanOrEqual(1.0)
  })
})

// ── Missed session ────────────────────────────────────────────────────────────

describe('handleMissedSession — secondary session', () => {
  it('absorbs secondary session, no rescheduling', () => {
    const ctx = makeCtx()
    const result = replan(
      {
        type: 'missed_session',
        session: makeSession({ day: 'wed', dayIndex: 2, discipline: 'run', durationMinutes: 30 }),
        scheduledDate: '2025-06-04',
      },
      ctx
    )
    expect(result.trigger).toBe('missed_session')
    expect(result.changes.some((c) => c.kind === 'session_absorbed')).toBe(true)
    expect(result.changes.some((c) => c.kind === 'session_rescheduled')).toBe(false)
  })

  it('removes the missed session from the schedule', () => {
    const ctx = makeCtx()
    const missedSession = makeSession({
      day: 'wed',
      dayIndex: 2,
      discipline: 'run',
      durationMinutes: 30,
    })
    const result = replan(
      {
        type: 'missed_session',
        session: missedSession,
        scheduledDate: '2025-06-04',
      },
      ctx
    )
    const wedSession = result.schedule.find((d) => d.day === 'wed')
    expect(wedSession?.session.discipline).not.toBe('run')
  })
})

describe('handleMissedSession — key session', () => {
  it('reschedules a key session to a free later day this week', () => {
    const ctx = makeCtx({
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      currentWeekSessions: [
        makeSession({ day: 'mon', dayIndex: 0, discipline: 'swim' }),
        makeSession({ day: 'tue', dayIndex: 1, discipline: 'bike', durationMinutes: 120 }),
        makeSession({ day: 'thu', dayIndex: 3, discipline: 'rest', durationMinutes: 0 }),
        makeSession({ day: 'sat', dayIndex: 5, discipline: 'bike' }),
        makeSession({ day: 'sun', dayIndex: 6, discipline: 'run' }),
      ],
    })
    const missed = makeSession({
      day: 'mon',
      dayIndex: 0,
      discipline: 'bike',
      durationMinutes: 120,
      primaryZone: 'z4',
      isHardSession: true,
    })
    const result = replan(
      {
        type: 'missed_session',
        session: missed,
        scheduledDate: '2025-06-02',
      },
      ctx
    )
    expect(result.changes.some((c) => c.kind === 'session_rescheduled')).toBe(true)
  })

  it('result has bilingual explanation', () => {
    const ctx = makeCtx()
    const missed = makeSession({
      day: 'fri',
      dayIndex: 4,
      discipline: 'bike',
      durationMinutes: 120,
    })
    const result = replan(
      { type: 'missed_session', session: missed, scheduledDate: '2025-06-06' },
      ctx
    )
    expect(result.explanation.en.length).toBeGreaterThan(10)
    expect(result.explanation.es.length).toBeGreaterThan(10)
  })

  it('absorbs key session when no valid slot exists', () => {
    // All remaining days are occupied
    const ctx = makeCtx({
      availableDays: ['mon', 'tue'],
      currentWeekSessions: [
        makeSession({ day: 'mon', dayIndex: 0, discipline: 'bike' }),
        makeSession({ day: 'tue', dayIndex: 1, discipline: 'run' }),
      ],
      nextWeekSessions: undefined,
      nextWeekAvailableDays: undefined,
    })
    const missed = makeSession({
      day: 'mon',
      dayIndex: 0,
      discipline: 'bike',
      durationMinutes: 120,
    })
    const result = replan(
      { type: 'missed_session', session: missed, scheduledDate: '2025-06-02' },
      ctx
    )
    expect(result.changes.some((c) => c.kind === 'session_absorbed')).toBe(true)
  })
})

// ── Fatigue signal ────────────────────────────────────────────────────────────

describe('handleFatigueSignal', () => {
  it('returns unchanged plan when no fatigue', () => {
    const ctx = makeCtx()
    const result = replan(
      {
        type: 'fatigue_signal',
        recentRpe: [5, 5, 5],
      },
      ctx
    )
    expect(result.isForcedRecoveryWeek).toBe(false)
    expect(result.changes).toHaveLength(0)
  })

  it('reduces next week hours by 15% on mild fatigue', () => {
    const ctx = makeCtx({ nextWeekHours: 10 })
    const result = replan(
      {
        type: 'fatigue_signal',
        recentRpe: [7, 7, 7],
      },
      ctx
    )
    expect(result.updatedWeeklyHours).toBeCloseTo(10 * 0.85, 1)
    expect(result.isForcedRecoveryWeek).toBe(true)
  })

  it('reduces next week hours by 20% on moderate fatigue', () => {
    const ctx = makeCtx({ nextWeekHours: 10 })
    const result = replan(
      {
        type: 'fatigue_signal',
        recentRpe: [8, 8, 8],
        hrvBaseline: 60,
        currentHrv: 50,
      },
      ctx
    )
    expect(result.updatedWeeklyHours).toBeCloseTo(10 * 0.8, 1)
  })

  it('shifts intensity distribution downward', () => {
    const ctx = makeCtx()
    const result = replan({ type: 'fatigue_signal', recentRpe: [7, 7, 7] }, ctx)
    const newDist = result.updatedIntensityDistribution
    expect(newDist.z4 + newDist.z5).toBeLessThan(baseDist.z4 + baseDist.z5)
  })

  it('new intensity distribution sums to 1', () => {
    const ctx = makeCtx()
    const result = replan(
      { type: 'fatigue_signal', recentRpe: [8, 8, 8], hrvBaseline: 60, currentHrv: 50 },
      ctx
    )
    const d = result.updatedIntensityDistribution
    expect(d.z1 + d.z2 + d.z3 + d.z4 + d.z5).toBeCloseTo(1, 4)
  })

  it('includes volume_reduced, intensity_shifted_down, and week_marked_recovery changes', () => {
    const ctx = makeCtx()
    const result = replan({ type: 'fatigue_signal', recentRpe: [7, 7, 7] }, ctx)
    const kinds = result.changes.map((c) => c.kind)
    expect(kinds).toContain('volume_reduced')
    expect(kinds).toContain('intensity_shifted_down')
    expect(kinds).toContain('week_marked_recovery')
  })

  it('rebuilds next week sessions when nextWeekAvailableDays provided', () => {
    const ctx = makeCtx()
    const result = replan({ type: 'fatigue_signal', recentRpe: [7, 7, 7] }, ctx)
    // Two-week schedule: 14 entries
    expect(result.schedule.length).toBeGreaterThan(7)
  })
})

// ── Availability change ───────────────────────────────────────────────────────

describe('handleAvailabilityChange', () => {
  it('drops secondary sessions on removed days', () => {
    const ctx = makeCtx()
    const planned = ctx.currentWeekSessions
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['wed'],
        remainingDays: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'],
        plannedSessions: planned,
      },
      ctx
    )
    expect(result.changes.some((c) => c.kind === 'session_dropped')).toBe(true)
    expect(result.schedule.every((d) => d.day !== 'wed')).toBe(true)
  })

  it('moves key sessions to remaining days', () => {
    const ctx = makeCtx()
    const planned = [
      makeSession({ day: 'sat', dayIndex: 5, discipline: 'bike', durationMinutes: 120 }), // key long ride
      makeSession({ day: 'mon', dayIndex: 0, discipline: 'swim' }),
      makeSession({ day: 'thu', dayIndex: 3, discipline: 'rest', durationMinutes: 0 }),
    ]
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['sat'],
        remainingDays: ['mon', 'thu', 'sun'],
        plannedSessions: planned,
      },
      ctx
    )
    expect(result.changes.some((c) => c.kind === 'session_moved')).toBe(true)
    // Key session (bike 120min) should appear on a remaining day
    const bikeSession = result.schedule.find((d) => d.session.discipline === 'bike')
    expect(bikeSession).toBeDefined()
    expect(['mon', 'thu', 'sun']).toContain(bikeSession!.day)
  })

  it('schedule contains no sessions on removed days', () => {
    const ctx = makeCtx()
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['tue', 'fri'],
        remainingDays: ['mon', 'wed', 'thu', 'sat', 'sun'],
        plannedSessions: ctx.currentWeekSessions,
      },
      ctx
    )
    for (const s of result.schedule) {
      expect(['tue', 'fri']).not.toContain(s.day)
    }
  })

  it('never places more than 2 hard sessions on a single day', () => {
    const ctx = makeCtx()
    const planned = [
      makeSession({
        day: 'mon',
        dayIndex: 0,
        discipline: 'bike',
        isHardSession: true,
        primaryZone: 'z4',
      }),
      makeSession({
        day: 'tue',
        dayIndex: 1,
        discipline: 'run',
        isHardSession: true,
        primaryZone: 'z4',
      }),
      makeSession({
        day: 'wed',
        dayIndex: 2,
        discipline: 'swim',
        isHardSession: true,
        primaryZone: 'z4',
      }),
    ]
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['tue', 'wed'],
        remainingDays: ['mon', 'thu', 'sat'],
        plannedSessions: planned,
      },
      ctx
    )
    const hardByDay = new Map<string, number>()
    for (const s of result.schedule) {
      if (s.session.isHardSession) {
        hardByDay.set(s.day, (hardByDay.get(s.day) ?? 0) + 1)
      }
    }
    for (const count of hardByDay.values()) {
      expect(count).toBeLessThanOrEqual(2)
    }
  })

  it('explanation includes count of moved and dropped sessions', () => {
    const ctx = makeCtx()
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['fri'],
        remainingDays: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'],
        plannedSessions: ctx.currentWeekSessions,
      },
      ctx
    )
    expect(result.explanation.en).toMatch(/\d+ session/)
  })
})

// ── Overperformance ───────────────────────────────────────────────────────────

describe('handleOverperformance', () => {
  it('returns unchanged plan when no overperformance', () => {
    const ctx = makeCtx()
    const planned = makeSession({ durationMinutes: 60, primaryZone: 'z2' })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 60, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 58, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 59, actualPrimaryZone: 'z2' },
    ]
    const result = replan({ type: 'overperformance', completedSessions: sessions }, ctx)
    expect(result.changes).toHaveLength(0)
    expect(result.updatedWeeklyHours).toBe(ctx.weeklyHours)
  })

  it('increases next week hours by ~5% on duration overperformance', () => {
    const ctx = makeCtx({ nextWeekHours: 10 })
    const planned = makeSession({ durationMinutes: 60, primaryZone: 'z2' })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 68, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 70, actualPrimaryZone: 'z2' },
      { planned, actualDurationMinutes: 72, actualPrimaryZone: 'z2' },
    ]
    const result = replan({ type: 'overperformance', completedSessions: sessions }, ctx)
    expect(result.updatedWeeklyHours).toBeGreaterThan(10)
    expect(result.updatedWeeklyHours).toBeCloseTo(10.5, 1)
    expect(result.changes.some((c) => c.kind === 'volume_increased')).toBe(true)
  })

  it('shifts intensity up on zone overperformance', () => {
    const ctx = makeCtx()
    const planned = makeSession({ primaryZone: 'z2' })
    const sessions: CompletedSession[] = [
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z3' },
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z3' },
      { planned, actualDurationMinutes: 45, actualPrimaryZone: 'z3' },
    ]
    const result = replan({ type: 'overperformance', completedSessions: sessions }, ctx)
    expect(result.changes.some((c) => c.kind === 'intensity_shifted_up')).toBe(true)
    expect(result.updatedIntensityDistribution.z4).toBeGreaterThan(baseDist.z4)
  })

  it('caps volume increase at 10% above weeklyHours', () => {
    const ctx = makeCtx({ weeklyHours: 10, nextWeekHours: 10 })
    const planned = makeSession({ durationMinutes: 60, primaryZone: 'z2' })
    const sessions: CompletedSession[] = Array(5)
      .fill(null)
      .map(() => ({
        planned,
        actualDurationMinutes: 90,
        actualPrimaryZone: 'z2' as ZoneKey,
      }))
    const result = replan({ type: 'overperformance', completedSessions: sessions }, ctx)
    expect(result.updatedWeeklyHours).toBeLessThanOrEqual(11)
  })

  it('isForcedRecoveryWeek is false on overperformance', () => {
    const ctx = makeCtx()
    const planned = makeSession({ durationMinutes: 60 })
    const sessions: CompletedSession[] = Array(3)
      .fill(null)
      .map(() => ({
        planned,
        actualDurationMinutes: 70,
        actualPrimaryZone: 'z2' as ZoneKey,
      }))
    const result = replan({ type: 'overperformance', completedSessions: sessions }, ctx)
    expect(result.isForcedRecoveryWeek).toBe(false)
  })
})

// ── replan dispatcher ─────────────────────────────────────────────────────────

describe('replan dispatcher', () => {
  it('routes missed_session trigger correctly', () => {
    const result = replan(
      {
        type: 'missed_session',
        session: makeSession(),
        scheduledDate: '2025-06-04',
      },
      makeCtx()
    )
    expect(result.trigger).toBe('missed_session')
  })

  it('routes fatigue_signal trigger correctly', () => {
    const result = replan({ type: 'fatigue_signal', recentRpe: [5] }, makeCtx())
    expect(result.trigger).toBe('fatigue_signal')
  })

  it('routes availability_change trigger correctly', () => {
    const result = replan(
      {
        type: 'availability_change',
        removedDays: ['wed'],
        remainingDays: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'],
        plannedSessions: makeCtx().currentWeekSessions,
      },
      makeCtx()
    )
    expect(result.trigger).toBe('availability_change')
  })

  it('routes overperformance trigger correctly', () => {
    const result = replan({ type: 'overperformance', completedSessions: [] }, makeCtx())
    expect(result.trigger).toBe('overperformance')
  })

  it('all trigger types return a schedule array', () => {
    const ctx = makeCtx()
    for (const trigger of [
      { type: 'missed_session' as const, session: makeSession(), scheduledDate: '2025-06-04' },
      { type: 'fatigue_signal' as const, recentRpe: [5] },
      {
        type: 'availability_change' as const,
        removedDays: ['wed'] as DayKey[],
        remainingDays: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'] as DayKey[],
        plannedSessions: ctx.currentWeekSessions,
      },
      { type: 'overperformance' as const, completedSessions: [] },
    ]) {
      const result = replan(trigger, ctx)
      expect(Array.isArray(result.schedule)).toBe(true)
      expect(result.explanation.en.length).toBeGreaterThan(5)
      expect(result.explanation.es.length).toBeGreaterThan(5)
    }
  })

  it('schedule entries have day, date, and session fields', () => {
    const result = replan({ type: 'fatigue_signal', recentRpe: [5] }, makeCtx())
    for (const entry of result.schedule) {
      expect(entry).toHaveProperty('day')
      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('session')
    }
  })
})
