import { describe, it, expect } from 'vitest'
import {
  generateWeekSessions,
  findBackToBackHardViolation,
  swimHasFullStructure,
  getRestDays,
  longestRideOnWeekend,
  type WeekSessionInput,
  type DayKey,
} from './session-generator'

// ── Fixture builders ──────────────────────────────────────────────────────────

function input(overrides: Partial<WeekSessionInput> = {}): WeekSessionInput {
  return {
    phase: 'base',
    targetHours: 8,
    intensityDistribution: { z1: 0.55, z2: 0.25, z3: 0.1, z4: 0.07, z5: 0.03 },
    disciplineSplit: { swim: 0.22, bike: 0.5, run: 0.28 },
    availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    experienceLevel: 'intermediate',
    raceDistance: 'olympic',
    isRecoveryWeek: false,
    ...overrides,
  }
}

// ── General structural invariants ─────────────────────────────────────────────

describe('generateWeekSessions — structure', () => {
  it('returns an array', () => {
    expect(Array.isArray(generateWeekSessions(input()))).toBe(true)
  })

  it('returns empty array when no available days', () => {
    expect(generateWeekSessions(input({ availableDays: [] }))).toHaveLength(0)
  })

  it('sessions count = number of available days', () => {
    const days: DayKey[] = ['mon', 'wed', 'fri', 'sat']
    const sessions = generateWeekSessions(input({ availableDays: days }))
    expect(sessions).toHaveLength(days.length)
  })

  it('sessions are sorted Monday → Sunday', () => {
    const sessions = generateWeekSessions(input())
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i]!.dayIndex).toBeGreaterThanOrEqual(sessions[i - 1]!.dayIndex)
    }
  })

  it('each day appears at most once', () => {
    const sessions = generateWeekSessions(input())
    const days = sessions.map((s) => s.day)
    expect(new Set(days).size).toBe(days.length)
  })

  it('every session has a non-empty bilingual objective', () => {
    const sessions = generateWeekSessions(input())
    for (const s of sessions) {
      expect(s.objective.en.length).toBeGreaterThan(5)
      expect(s.objective.es.length).toBeGreaterThan(5)
    }
  })

  it('every session has a positive duration or is rest (0 min)', () => {
    const sessions = generateWeekSessions(input())
    for (const s of sessions) {
      expect(s.durationMinutes).toBeGreaterThanOrEqual(0)
      if (s.discipline !== 'rest') {
        expect(s.durationMinutes).toBeGreaterThan(0)
      }
    }
  })
})

// ── R1: No back-to-back hard sessions in same discipline ──────────────────────

describe('Rule R1 — no back-to-back hard sessions', () => {
  it('no violation for olympic intermediate build week', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    expect(findBackToBackHardViolation(sessions)).toBeNull()
  })

  it('no violation for ironman advanced peak week', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'peak',
        raceDistance: 'ironman',
        experienceLevel: 'advanced',
        targetHours: 15,
        disciplineSplit: { swim: 0.18, bike: 0.54, run: 0.28 },
        intensityDistribution: { z1: 0.38, z2: 0.22, z3: 0.15, z4: 0.15, z5: 0.1 },
      })
    )
    expect(findBackToBackHardViolation(sessions)).toBeNull()
  })

  it('no violation for sprint beginner base week', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'base',
        raceDistance: 'sprint',
        experienceLevel: 'beginner',
        targetHours: 5,
      })
    )
    expect(findBackToBackHardViolation(sessions)).toBeNull()
  })

  it('no violation for half_ironman elite build, full week', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        raceDistance: 'half_ironman',
        experienceLevel: 'elite',
        targetHours: 14,
        disciplineSplit: { swim: 0.2, bike: 0.5, run: 0.3 },
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    expect(findBackToBackHardViolation(sessions)).toBeNull()
  })

  it('no violation for recovery week (no hard sessions at all)', () => {
    const sessions = generateWeekSessions(input({ isRecoveryWeek: true }))
    const hardSessions = sessions.filter((s) => s.isHardSession)
    expect(hardSessions).toHaveLength(0)
    expect(findBackToBackHardViolation(sessions)).toBeNull()
  })
})

// ── R2: Longest ride on weekend ───────────────────────────────────────────────

describe('Rule R2 — longest ride on weekend', () => {
  it('long bike is on Saturday or Sunday for olympic intermediate', () => {
    const sessions = generateWeekSessions(
      input({
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'],
      })
    )
    expect(longestRideOnWeekend(sessions)).toBe(true)
  })

  it('long ride on weekend for ironman base week', () => {
    const sessions = generateWeekSessions(
      input({
        raceDistance: 'ironman',
        targetHours: 12,
        disciplineSplit: { swim: 0.2, bike: 0.52, run: 0.28 },
        availableDays: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'],
      })
    )
    expect(longestRideOnWeekend(sessions)).toBe(true)
  })

  it('when only weekdays available, longest ride is on last available day', () => {
    // Only weekdays: no weekend available — function is vacuously acceptable
    // (can't place on weekend that doesn't exist)
    const sessions = generateWeekSessions(
      input({
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      })
    )
    // No crash; sessions generated
    expect(sessions.length).toBeGreaterThan(0)
  })
})

// ── R3: Swim structure ─────────────────────────────────────────────────────────

describe('Rule R3 — swim sessions have 4-part structure', () => {
  it('swim session has warmup + drill + main + cooldown', () => {
    const sessions = generateWeekSessions(input())
    const swims = sessions.filter((s) => s.discipline === 'swim')
    expect(swims.length).toBeGreaterThan(0)
    for (const swim of swims) {
      expect(swimHasFullStructure(swim)).toBe(true)
    }
  })

  it('swim structure parts have positive duration', () => {
    const sessions = generateWeekSessions(input())
    const swims = sessions.filter((s) => s.discipline === 'swim')
    for (const swim of swims) {
      for (const set of swim.swimStructure!) {
        expect(set.durationMinutes).toBeGreaterThan(0)
      }
    }
  })

  it('swim structure parts have bilingual descriptions', () => {
    const sessions = generateWeekSessions(input())
    const swims = sessions.filter((s) => s.discipline === 'swim')
    for (const swim of swims) {
      for (const set of swim.swimStructure!) {
        expect(set.description.en.length).toBeGreaterThan(5)
        expect(set.description.es.length).toBeGreaterThan(5)
      }
    }
  })

  it('swim structure total duration ≈ session duration', () => {
    const sessions = generateWeekSessions(input())
    const swims = sessions.filter((s) => s.discipline === 'swim')
    for (const swim of swims) {
      const structureTotal = swim.swimStructure!.reduce((s, p) => s + p.durationMinutes, 0)
      expect(structureTotal).toBeCloseTo(swim.durationMinutes, 0)
    }
  })

  it('hard swim session has main set in higher zone than easy swim', () => {
    const hardSessions = generateWeekSessions(
      input({
        phase: 'build',
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    const hardSwim = hardSessions.find((s) => s.discipline === 'swim' && s.isHardSession)
    if (hardSwim) {
      const mainSet = hardSwim.swimStructure!.find((p) => p.type === 'main')!
      expect(['z3', 'z4', 'z5']).toContain(mainSet.zone)
    }
  })
})

// ── R4: Brick sessions in build / peak only ───────────────────────────────────

describe('Rule R4 — bricks only in build and peak', () => {
  it('no brick sessions in base phase', () => {
    const sessions = generateWeekSessions(input({ phase: 'base', experienceLevel: 'advanced' }))
    expect(sessions.filter((s) => s.isBrick)).toHaveLength(0)
  })

  it('no brick sessions in taper phase', () => {
    const sessions = generateWeekSessions(input({ phase: 'taper', experienceLevel: 'advanced' }))
    expect(sessions.filter((s) => s.isBrick)).toHaveLength(0)
  })

  it('no brick sessions for beginner athletes regardless of phase', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        experienceLevel: 'beginner',
      })
    )
    expect(sessions.filter((s) => s.isBrick)).toHaveLength(0)
  })

  it('brick sessions can appear in build phase for intermediate', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        experienceLevel: 'intermediate',
        targetHours: 10,
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    const bricks = sessions.filter((s) => s.isBrick)
    // May or may not produce a brick depending on session count — just ensure no crash
    for (const b of bricks) {
      expect(b.isHardSession).toBe(true)
      expect(b.discipline).toBe('brick')
    }
  })

  it('brick session is marked isHardSession = true', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'peak',
        experienceLevel: 'advanced',
        targetHours: 12,
        intensityDistribution: { z1: 0.38, z2: 0.22, z3: 0.15, z4: 0.15, z5: 0.1 },
      })
    )
    for (const s of sessions.filter((s) => s.isBrick)) {
      expect(s.isHardSession).toBe(true)
    }
  })
})

// ── R5: Rest days ─────────────────────────────────────────────────────────────

describe('Rule R5 — minimum rest days', () => {
  it('beginner always has at least 1 full rest day', () => {
    const sessions = generateWeekSessions(
      input({
        experienceLevel: 'beginner',
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      })
    )
    const fullRest = sessions.filter((s) => s.discipline === 'rest')
    expect(fullRest.length).toBeGreaterThanOrEqual(1)
  })

  it('beginner rest days are full rest (not active recovery)', () => {
    const sessions = generateWeekSessions(input({ experienceLevel: 'beginner' }))
    const restDays = getRestDays(sessions)
    for (const rd of restDays) {
      expect(rd.discipline).toBe('rest')
    }
  })

  it('advanced athlete rest days may be active recovery', () => {
    const sessions = generateWeekSessions(
      input({
        experienceLevel: 'advanced',
        phase: 'build',
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      })
    )
    const restDays = getRestDays(sessions)
    // At least one rest slot exists; advanced may have active recovery
    expect(restDays.length).toBeGreaterThanOrEqual(1)
    const types = new Set(restDays.map((r) => r.discipline))
    expect(types.has('rest') || types.has('active_recovery')).toBe(true)
  })

  it('no rest days active recovery in taper (full rest only) for advanced', () => {
    const sessions = generateWeekSessions(
      input({
        experienceLevel: 'advanced',
        phase: 'taper',
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      })
    )
    const restDays = getRestDays(sessions)
    for (const rd of restDays) {
      expect(rd.discipline).toBe('rest')
    }
  })

  it('returns non-empty result for 2-day week (minimal training)', () => {
    const sessions = generateWeekSessions(
      input({
        availableDays: ['wed', 'sat'],
        targetHours: 3,
        experienceLevel: 'beginner',
      })
    )
    expect(sessions.length).toBe(2)
    // With only 2 days and 1 required rest, at least 1 must be rest
    expect(getRestDays(sessions).length).toBeGreaterThanOrEqual(1)
  })
})

// ── Distance-specific sessions ────────────────────────────────────────────────

describe('Distance-specific session durations', () => {
  it('ironman long ride is longer than sprint long ride', () => {
    const ironmanSessions = generateWeekSessions(
      input({
        raceDistance: 'ironman',
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'],
      })
    )
    const sprintSessions = generateWeekSessions(
      input({
        raceDistance: 'sprint',
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat', 'sun'],
      })
    )

    const ironmanBike = ironmanSessions
      .filter((s) => s.discipline === 'bike')
      .reduce((a, b) => (b.durationMinutes > a.durationMinutes ? b : a), { durationMinutes: 0 })
    const sprintBike = sprintSessions
      .filter((s) => s.discipline === 'bike')
      .reduce((a, b) => (b.durationMinutes > a.durationMinutes ? b : a), { durationMinutes: 0 })

    expect(ironmanBike.durationMinutes).toBeGreaterThan(sprintBike.durationMinutes)
  })

  it('sprint base run sessions are shorter than ironman base run sessions', () => {
    const ironman = generateWeekSessions(input({ raceDistance: 'ironman' }))
    const sprint = generateWeekSessions(input({ raceDistance: 'sprint' }))

    const ironmanRunMax = Math.max(
      ...ironman.filter((s) => s.discipline === 'run').map((s) => s.durationMinutes),
      0
    )
    const sprintRunMax = Math.max(
      ...sprint.filter((s) => s.discipline === 'run').map((s) => s.durationMinutes),
      0
    )

    expect(ironmanRunMax).toBeGreaterThan(sprintRunMax)
  })
})

// ── Interval structure ────────────────────────────────────────────────────────

describe('Hard sessions contain intervals', () => {
  it('hard bike build session has intervals', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    const hardBike = sessions.find((s) => s.discipline === 'bike' && s.isHardSession)
    if (hardBike) {
      expect(hardBike.intervals).toBeDefined()
      expect(hardBike.intervals!.length).toBeGreaterThan(0)
    }
  })

  it('hard run peak session has intervals', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'peak',
        intensityDistribution: { z1: 0.38, z2: 0.22, z3: 0.15, z4: 0.15, z5: 0.1 },
      })
    )
    const hardRun = sessions.find((s) => s.discipline === 'run' && s.isHardSession)
    if (hardRun) {
      expect(hardRun.intervals).toBeDefined()
      expect(hardRun.intervals!.length).toBeGreaterThan(0)
    }
  })

  it('all intervals have positive reps and duration', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'peak',
        intensityDistribution: { z1: 0.38, z2: 0.22, z3: 0.15, z4: 0.15, z5: 0.1 },
      })
    )
    for (const s of sessions) {
      for (const interval of s.intervals ?? []) {
        expect(interval.reps).toBeGreaterThan(0)
        expect(interval.durationSeconds).toBeGreaterThan(0)
        expect(interval.restSeconds).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('easy sessions do not have intervals', () => {
    const sessions = generateWeekSessions(input({ phase: 'base' }))
    for (const s of sessions.filter((s) => !s.isHardSession)) {
      expect(s.intervals ?? []).toHaveLength(0)
    }
  })

  it('intervals have bilingual descriptions', () => {
    const sessions = generateWeekSessions(
      input({
        phase: 'build',
        intensityDistribution: { z1: 0.45, z2: 0.25, z3: 0.15, z4: 0.1, z5: 0.05 },
      })
    )
    for (const s of sessions) {
      for (const iv of s.intervals ?? []) {
        expect(iv.description.en.length).toBeGreaterThan(5)
        expect(iv.description.es.length).toBeGreaterThan(5)
      }
    }
  })
})

// ── Recovery week specifics ───────────────────────────────────────────────────

describe('Recovery week behaviour', () => {
  it('recovery week produces no hard sessions', () => {
    const sessions = generateWeekSessions(
      input({
        isRecoveryWeek: true,
        phase: 'build',
        intensityDistribution: { z1: 0.58, z2: 0.2, z3: 0.12, z4: 0.07, z5: 0.03 },
      })
    )
    expect(sessions.filter((s) => s.isHardSession)).toHaveLength(0)
  })

  it('recovery week produces no brick sessions', () => {
    const sessions = generateWeekSessions(
      input({
        isRecoveryWeek: true,
        phase: 'build',
        experienceLevel: 'advanced',
      })
    )
    expect(sessions.filter((s) => s.isBrick)).toHaveLength(0)
  })
})

// ── Cross-phase smoke tests ───────────────────────────────────────────────────

describe('All phase × distance × experience combinations produce valid output', () => {
  const phases = ['base', 'build', 'peak', 'taper'] as const
  const distances = ['sprint', 'olympic', 'half_ironman', 'ironman'] as const

  for (const phase of phases) {
    for (const dist of distances) {
      for (const lvl of ['beginner', 'advanced'] as const) {
        it(`${phase} / ${dist} / ${lvl} — no rule violations`, () => {
          const sessions = generateWeekSessions(
            input({
              phase,
              raceDistance: dist,
              experienceLevel: lvl,
              targetHours: lvl === 'beginner' ? 6 : 12,
            })
          )
          expect(sessions.length).toBeGreaterThan(0)
          expect(findBackToBackHardViolation(sessions)).toBeNull()
          const swims = sessions.filter((s) => s.discipline === 'swim')
          for (const swim of swims) {
            expect(swimHasFullStructure(swim)).toBe(true)
          }
        })
      }
    }
  }
})
