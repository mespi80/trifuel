import { describe, it, expect } from 'vitest'
import {
  calculateSessionHydration,
  calculateDailyHydration,
  calculateElectrolytes,
  checkOverHydration,
  getSessionHydrationTip,
  HYDRATION_BASE_ML_PER_KG,
  HYDRATION_TRAINING_MIN_ML_PER_HR,
  HYDRATION_TRAINING_MAX_ML_PER_HR,
  OVER_HYDRATION_ML_PER_HR,
} from './hydration'
import type { SessionInput } from './macro-calculator'

// ── calculateSessionHydration ──────────────────────────────────────────────────

describe('calculateSessionHydration', () => {
  it('returns higher during-session fluid for z5 than z1', () => {
    const z1 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z1',
    })
    const z5 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z5',
    })
    expect(z5.duringSessionMl).toBeGreaterThan(z1.duringSessionMl)
  })

  it('z1 60-min session uses minimum rate (500 ml/hr)', () => {
    const g = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 60,
      intensityZone: 'z1',
    })
    expect(g.duringSessionMl).toBe(HYDRATION_TRAINING_MIN_ML_PER_HR)
  })

  it('z5 60-min session uses maximum rate (750 ml/hr)', () => {
    const g = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z5',
    })
    expect(g.duringSessionMl).toBe(HYDRATION_TRAINING_MAX_ML_PER_HR)
  })

  it('scales linearly with duration', () => {
    const g30 = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 30,
      intensityZone: 'z3',
    })
    const g60 = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 60,
      intensityZone: 'z3',
    })
    // Allow ±1 ml rounding difference from per-calculation Math.round
    expect(Math.abs(g60.duringSessionMl - g30.duringSessionMl * 2)).toBeLessThanOrEqual(1)
  })

  it('no sodium for sessions <= 60 min', () => {
    const g = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z4',
    })
    expect(g.sodiumMg).toBe(0)
  })

  it('includes sodium for sessions > 60 min', () => {
    const g = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 90,
      intensityZone: 'z3',
    })
    expect(g.sodiumMg).toBeGreaterThan(0)
  })

  it('sodium scales with intensity for long sessions', () => {
    const z1 = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 120,
      intensityZone: 'z1',
    })
    const z5 = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 120,
      intensityZone: 'z5',
    })
    expect(z5.sodiumMg).toBeGreaterThan(z1.sodiumMg)
  })

  it('sodium min is 300 mg/hr, max 600 mg/hr for 60+ min sessions', () => {
    const z1 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 120,
      intensityZone: 'z1',
    })
    const z5 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 120,
      intensityZone: 'z5',
    })
    expect(z1.sodiumMg).toBe(600) // 300 mg/hr × 2 hrs
    expect(z5.sodiumMg).toBe(1200) // 600 mg/hr × 2 hrs
  })

  it('pre-session fluid is higher for z5 than z1', () => {
    const z1 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z1',
    })
    const z5 = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z5',
    })
    expect(z5.preMl).toBeGreaterThan(z1.preMl)
  })

  it('sip interval is 15 min for sessions >= 60 min', () => {
    const g = calculateSessionHydration({
      discipline: 'bike',
      durationMinutes: 60,
      intensityZone: 'z2',
    })
    expect(g.sipEveryMinutes).toBe(15)
  })

  it('sip interval is 20 min for sessions < 60 min', () => {
    const g = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 30,
      intensityZone: 'z3',
    })
    expect(g.sipEveryMinutes).toBe(20)
  })

  it('defaults missing zone to moderate scale', () => {
    const withZone = calculateSessionHydration({
      discipline: 'run',
      durationMinutes: 60,
      intensityZone: 'z3',
    })
    const withoutZone = calculateSessionHydration({ discipline: 'run', durationMinutes: 60 })
    // z3 scale = 0.5, null default scale = 0.5 — should produce same result
    expect(withoutZone.duringSessionMl).toBe(withZone.duringSessionMl)
  })
})

// ── calculateDailyHydration ────────────────────────────────────────────────────

describe('calculateDailyHydration', () => {
  it('rest day: only base hydration', () => {
    const result = calculateDailyHydration(70, [])
    expect(result.baseMl).toBe(70 * HYDRATION_BASE_ML_PER_KG)
    expect(result.trainingMl).toBe(0)
    expect(result.totalMl).toBe(result.baseMl)
  })

  it('base scales with body weight', () => {
    const r50 = calculateDailyHydration(50, [])
    const r90 = calculateDailyHydration(90, [])
    expect(r90.baseMl).toBeGreaterThan(r50.baseMl)
    expect(r90.baseMl).toBe(90 * HYDRATION_BASE_ML_PER_KG)
  })

  it('training adds to base', () => {
    const session: SessionInput = { discipline: 'bike', durationMinutes: 60, intensityZone: 'z3' }
    const result = calculateDailyHydration(70, [session])
    expect(result.trainingMl).toBeGreaterThan(0)
    expect(result.totalMl).toBe(result.baseMl + result.trainingMl)
  })

  it('recovery sessions do not add training hydration', () => {
    const recovery: SessionInput = { discipline: 'recovery', durationMinutes: 60 }
    const result = calculateDailyHydration(70, [recovery])
    expect(result.trainingMl).toBe(0)
    expect(result.sessions).toHaveLength(0)
  })

  it('multiple sessions accumulate', () => {
    const sessions: SessionInput[] = [
      { discipline: 'swim', durationMinutes: 45, intensityZone: 'z2' },
      { discipline: 'run', durationMinutes: 30, intensityZone: 'z4' },
    ]
    const result = calculateDailyHydration(70, sessions)
    expect(result.sessions).toHaveLength(2)
    expect(result.trainingMl).toBeGreaterThan(0)
  })

  it('total = base + all session during-amounts', () => {
    const sessions: SessionInput[] = [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z3' },
    ]
    const result = calculateDailyHydration(75, sessions)
    const expectedTraining = result.sessions.reduce((s, g) => s + g.duringSessionMl, 0)
    expect(result.trainingMl).toBe(expectedTraining)
  })
})

// ── calculateElectrolytes ──────────────────────────────────────────────────────

describe('calculateElectrolytes', () => {
  it('rest day: trainingDay is false', () => {
    const e = calculateElectrolytes([])
    expect(e.trainingDay).toBe(false)
  })

  it('training day: trainingDay is true', () => {
    const e = calculateElectrolytes([
      { discipline: 'run', durationMinutes: 45, intensityZone: 'z3' },
    ])
    expect(e.trainingDay).toBe(true)
  })

  it('training day has higher sodium than rest day', () => {
    const rest = calculateElectrolytes([])
    const training = calculateElectrolytes([
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z4' },
    ])
    expect(training.sodiumMg).toBeGreaterThan(rest.sodiumMg)
  })

  it('high-intensity day has higher electrolytes than low-intensity', () => {
    const low = calculateElectrolytes([
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z1' },
    ])
    const high = calculateElectrolytes([
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z5' },
    ])
    expect(high.sodiumMg).toBeGreaterThanOrEqual(low.sodiumMg)
    expect(high.potassiumMg).toBeGreaterThanOrEqual(low.potassiumMg)
  })

  it('rest day sodium is 1500 mg', () => {
    expect(calculateElectrolytes([]).sodiumMg).toBe(1500)
  })

  it('recovery-only sessions treated as rest', () => {
    const recovery = calculateElectrolytes([{ discipline: 'recovery', durationMinutes: 60 }])
    expect(recovery.trainingDay).toBe(false)
    expect(recovery.sodiumMg).toBe(1500)
  })

  it('all electrolytes are positive integers', () => {
    const e = calculateElectrolytes([
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z3' },
    ])
    expect(e.sodiumMg).toBeGreaterThan(0)
    expect(e.potassiumMg).toBeGreaterThan(0)
    expect(e.magnesiumMg).toBeGreaterThan(0)
    expect(Number.isInteger(e.sodiumMg)).toBe(true)
  })
})

// ── checkOverHydration ─────────────────────────────────────────────────────────

function log(minutesAgo: number, amountMl: number) {
  return { loggedAt: new Date(Date.now() - minutesAgo * 60_000), amountMl }
}

describe('checkOverHydration', () => {
  it('no risk with empty log', () => {
    expect(checkOverHydration([]).risk).toBe(false)
  })

  it('no risk with single entry', () => {
    expect(checkOverHydration([log(0, 500)]).risk).toBe(false)
  })

  it('no risk under 1000 ml/hr', () => {
    const logs = [log(30, 400), log(10, 300)]
    expect(checkOverHydration(logs).risk).toBe(false)
  })

  it('flags risk when > 1000 ml consumed in 60-min window', () => {
    const logs = [log(55, 500), log(40, 300), log(25, 300)]
    expect(checkOverHydration(logs).risk).toBe(true)
    expect(checkOverHydration(logs).peakRateMlPerHr).toBeGreaterThan(OVER_HYDRATION_ML_PER_HR)
  })

  it('exactly 1000 ml/hr does NOT flag (> not >=)', () => {
    const logs = [log(59, 500), log(1, 500)]
    expect(checkOverHydration(logs).risk).toBe(false)
    expect(checkOverHydration(logs).peakRateMlPerHr).toBe(1000)
  })

  it('entries outside the 60-min window are not counted', () => {
    const logs = [
      log(90, 600), // 90 min ago — outside 60-min window
      log(10, 300),
      log(5, 300),
    ]
    expect(checkOverHydration(logs).risk).toBe(false)
  })

  it('returns peakRateMlPerHr as a rounded number', () => {
    const result = checkOverHydration([log(30, 400), log(10, 300)])
    expect(Number.isInteger(result.peakRateMlPerHr)).toBe(true)
  })

  it('handles unsorted logs', () => {
    const logs = [log(5, 300), log(55, 500), log(25, 300)]
    // same data as the flag test — should still detect risk
    expect(checkOverHydration(logs).risk).toBe(true)
  })
})

// ── getSessionHydrationTip ─────────────────────────────────────────────────────

describe('getSessionHydrationTip', () => {
  it.each(['swim', 'bike', 'run', 'brick', 'strength', 'recovery'] as SessionInput['discipline'][])(
    '%s returns a non-empty string',
    (discipline) => {
      const tip = getSessionHydrationTip({ discipline, durationMinutes: 60, intensityZone: 'z3' })
      expect(typeof tip).toBe('string')
      expect(tip.length).toBeGreaterThan(0)
    }
  )

  it('bike tip mentions bottles', () => {
    const tip = getSessionHydrationTip({
      discipline: 'bike',
      durationMinutes: 90,
      intensityZone: 'z3',
    })
    expect(tip.toLowerCase()).toContain('bottle')
  })

  it('long bike tip includes sodium', () => {
    const tip = getSessionHydrationTip({
      discipline: 'bike',
      durationMinutes: 90,
      intensityZone: 'z4',
    })
    expect(tip.toLowerCase()).toContain('sodium')
  })

  it('short run tip does not include sodium', () => {
    const tip = getSessionHydrationTip({
      discipline: 'run',
      durationMinutes: 45,
      intensityZone: 'z2',
    })
    expect(tip.toLowerCase()).not.toContain('sodium')
  })
})
