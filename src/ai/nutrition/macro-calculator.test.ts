import { describe, it, expect } from 'vitest'
import {
  classifyTrainingDay,
  calculateCho,
  calculateProtein,
  calculateHydration,
  calculateMeals,
  calculateDailyMacros,
  CHO_RANGES,
  PROTEIN_RANGES,
  FAT_MIN_G_PER_KG,
  HYDRATION_BASE_ML_PER_KG,
  MIN_MEAL_PROTEIN_G,
  MEALS_HIGH_PROTEIN_THRESHOLD_G,
} from './macro-calculator'
import type { SessionInput, NutritionAthleteProfile } from './macro-calculator'

// ── classifyTrainingDay ───────────────────────────────────────────────────────

describe('classifyTrainingDay', () => {
  it('no sessions → rest', () => {
    expect(classifyTrainingDay([])).toBe('rest')
  })

  it('only a recovery session → rest', () => {
    expect(
      classifyTrainingDay([{ discipline: 'recovery', durationMinutes: 45, intensityZone: 'z1' }])
    ).toBe('rest')
  })

  it('multiple recovery sessions → rest', () => {
    expect(
      classifyTrainingDay([
        { discipline: 'recovery', durationMinutes: 30 },
        { discipline: 'recovery', durationMinutes: 30 },
      ])
    ).toBe('rest')
  })

  it('short z1 session (30 min) → light', () => {
    expect(
      classifyTrainingDay([{ discipline: 'swim', durationMinutes: 30, intensityZone: 'z1' }])
    ).toBe('light')
  })

  it('45-min z1 run → light (no z2+, under 60 min total)', () => {
    expect(
      classifyTrainingDay([{ discipline: 'run', durationMinutes: 45, intensityZone: 'z1' }])
    ).toBe('light')
  })

  it('z2 session → moderate', () => {
    expect(
      classifyTrainingDay([{ discipline: 'bike', durationMinutes: 45, intensityZone: 'z2' }])
    ).toBe('moderate')
  })

  it('z3 tempo session → moderate', () => {
    expect(
      classifyTrainingDay([{ discipline: 'run', durationMinutes: 45, intensityZone: 'z3' }])
    ).toBe('moderate')
  })

  it('60-min z1 session → moderate (total ≥ 60 min)', () => {
    expect(
      classifyTrainingDay([{ discipline: 'bike', durationMinutes: 60, intensityZone: 'z1' }])
    ).toBe('moderate')
  })

  it('two short easy sessions totalling 60 min → moderate', () => {
    expect(
      classifyTrainingDay([
        { discipline: 'swim', durationMinutes: 30, intensityZone: 'z1' },
        { discipline: 'run', durationMinutes: 30, intensityZone: 'z1' },
      ])
    ).toBe('moderate')
  })

  it('z4 threshold session → hard', () => {
    expect(
      classifyTrainingDay([{ discipline: 'run', durationMinutes: 30, intensityZone: 'z4' }])
    ).toBe('hard')
  })

  it('z5 VO2-max session → hard', () => {
    expect(
      classifyTrainingDay([{ discipline: 'bike', durationMinutes: 20, intensityZone: 'z5' }])
    ).toBe('hard')
  })

  it('z6 anaerobic session → hard', () => {
    expect(
      classifyTrainingDay([{ discipline: 'run', durationMinutes: 15, intensityZone: 'z6' }])
    ).toBe('hard')
  })

  it('brick session → hard regardless of zone', () => {
    expect(
      classifyTrainingDay([{ discipline: 'brick', durationMinutes: 50, intensityZone: 'z2' }])
    ).toBe('hard')
  })

  it('single session ≥ 90 min → hard (long session rule)', () => {
    expect(
      classifyTrainingDay([{ discipline: 'bike', durationMinutes: 90, intensityZone: 'z2' }])
    ).toBe('hard')
  })

  it('two sessions totalling ≥ 120 min → hard', () => {
    expect(
      classifyTrainingDay([
        { discipline: 'swim', durationMinutes: 60, intensityZone: 'z2' },
        { discipline: 'run', durationMinutes: 60, intensityZone: 'z2' },
      ])
    ).toBe('hard')
  })

  it('recovery + z4 run → hard (z4 trumps recovery)', () => {
    expect(
      classifyTrainingDay([
        { discipline: 'recovery', durationMinutes: 60 },
        { discipline: 'run', durationMinutes: 30, intensityZone: 'z4' },
      ])
    ).toBe('hard')
  })

  it('strength sessions count toward total load (not treated as recovery)', () => {
    // 2 × 60-min strength sessions = 120 min active → hard via total >= 120 rule
    expect(
      classifyTrainingDay([
        { discipline: 'strength', durationMinutes: 60 },
        { discipline: 'strength', durationMinutes: 60 },
      ])
    ).toBe('hard')
  })
})

// ── calculateCho ──────────────────────────────────────────────────────────────

describe('calculateCho', () => {
  const W = 70

  it('rest day → 3.5 g/kg (midpoint)', () => {
    const r = calculateCho(W, 'rest', [])
    expect(r.g).toBeCloseTo(W * 3.5, 0)
  })

  it('rest day exposes correct range', () => {
    const r = calculateCho(W, 'rest', [])
    expect(r.range.minGPerKg).toBe(CHO_RANGES.rest.min)
    expect(r.range.maxGPerKg).toBe(CHO_RANGES.rest.max)
  })

  it('light day → 5.5 g/kg (midpoint)', () => {
    const r = calculateCho(W, 'light', [
      { discipline: 'run', durationMinutes: 30, intensityZone: 'z1' },
    ])
    expect(r.g).toBeCloseTo(W * 5.5, 0)
  })

  it('moderate at 60 effective-min → 6 g/kg (lower bound)', () => {
    // 60 min × Z3 (mult=1.0) = 60 eff-min → scale=0 → 6 g/kg
    const r = calculateCho(W, 'moderate', [
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z3' },
    ])
    expect(r.g).toBeCloseTo(W * 6, 0)
  })

  it('moderate exposes correct range', () => {
    const r = calculateCho(W, 'moderate', [])
    expect(r.range.minGPerKg).toBe(6)
    expect(r.range.maxGPerKg).toBe(8)
  })

  it('moderate at 120 effective-min → 8 g/kg (upper bound)', () => {
    // 120 min × Z3 (mult=1.0) = 120 eff-min → scale=1 → 8 g/kg
    const r = calculateCho(W, 'moderate', [
      { discipline: 'bike', durationMinutes: 120, intensityZone: 'z3' },
    ])
    expect(r.g).toBeCloseTo(W * 8, 0)
  })

  it('moderate is bounded above at 8 g/kg', () => {
    const r = calculateCho(W, 'moderate', [
      { discipline: 'bike', durationMinutes: 240, intensityZone: 'z3' },
    ])
    expect(r.g / W).toBeLessThanOrEqual(8.01)
  })

  it('hard at 90 effective-min → 8 g/kg (lower bound)', () => {
    // 90 min × Z3 (mult=1.0) = 90 eff-min → scale=0 → 8 g/kg
    const r = calculateCho(W, 'hard', [
      { discipline: 'run', durationMinutes: 90, intensityZone: 'z3' },
    ])
    expect(r.g).toBeCloseTo(W * 8, 0)
  })

  it('hard exposes correct range', () => {
    const r = calculateCho(W, 'hard', [])
    expect(r.range.minGPerKg).toBe(8)
    expect(r.range.maxGPerKg).toBe(12)
  })

  it('hard at 270 effective-min → 12 g/kg (upper bound)', () => {
    // 270 min × Z3 (mult=1.0) = 270 eff-min → scale=1 → 12 g/kg
    const r = calculateCho(W, 'hard', [
      { discipline: 'bike', durationMinutes: 270, intensityZone: 'z3' },
    ])
    expect(r.g).toBeCloseTo(W * 12, 0)
  })

  it('hard is bounded above at 12 g/kg', () => {
    const r = calculateCho(W, 'hard', [
      { discipline: 'bike', durationMinutes: 600, intensityZone: 'z6' },
    ])
    expect(r.g / W).toBeLessThanOrEqual(12.01)
  })

  it('Z5 intensity boosts CHO relative to Z3 (same duration)', () => {
    // Z5 mult=1.6 gives more eff-min than Z3 mult=1.0 for same clock-time
    const z3 = calculateCho(W, 'hard', [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z3' },
    ])
    const z5 = calculateCho(W, 'hard', [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z5' },
    ])
    expect(z5.g).toBeGreaterThan(z3.g)
  })

  it('CHO scales proportionally with weight', () => {
    const r70 = calculateCho(70, 'light', [])
    const r80 = calculateCho(80, 'light', [])
    expect(r80.g / r70.g).toBeCloseTo(80 / 70, 1)
  })

  it('output is always within declared range for all day types', () => {
    for (const [dayType, range] of Object.entries(CHO_RANGES) as [
      keyof typeof CHO_RANGES,
      { min: number; max: number },
    ][]) {
      const r = calculateCho(70, dayType, [])
      const gPerKg = r.g / 70
      expect(gPerKg).toBeGreaterThanOrEqual(range.min - 0.01)
      expect(gPerKg).toBeLessThanOrEqual(range.max + 0.01)
    }
  })

  it('CHO increases from rest → light → moderate (at midpoint load) → hard', () => {
    const rest = calculateCho(W, 'rest', []).g
    const light = calculateCho(W, 'light', []).g
    const mod = calculateCho(W, 'moderate', [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z3' },
    ]).g
    const hard = calculateCho(W, 'hard', [
      { discipline: 'bike', durationMinutes: 180, intensityZone: 'z4' },
    ]).g
    expect(light).toBeGreaterThan(rest)
    expect(mod).toBeGreaterThan(light)
    expect(hard).toBeGreaterThan(mod)
  })
})

// ── calculateProtein ──────────────────────────────────────────────────────────

describe('calculateProtein', () => {
  it('under-40, rest day → 1.6 g/kg (minimum)', () => {
    const r = calculateProtein(70, 30, 'rest')
    expect(r.g).toBeCloseTo(70 * 1.6, 0)
  })

  it('under-40, light day → 1.6 g/kg (minimum)', () => {
    const r = calculateProtein(70, 30, 'light')
    expect(r.g).toBeCloseTo(70 * 1.6, 0)
  })

  it('under-40, moderate day → 1.8 g/kg (midpoint)', () => {
    const r = calculateProtein(70, 30, 'moderate')
    expect(r.g).toBeCloseTo(70 * 1.8, 0)
  })

  it('under-40, hard day → 2.0 g/kg (maximum)', () => {
    const r = calculateProtein(70, 30, 'hard')
    expect(r.g).toBeCloseTo(70 * 2.0, 0)
  })

  it('under-40 exposes correct range', () => {
    const r = calculateProtein(70, 30, 'hard')
    expect(r.range.minGPerKg).toBe(PROTEIN_RANGES.under40.min)
    expect(r.range.maxGPerKg).toBe(PROTEIN_RANGES.under40.max)
  })

  it('over-40, rest day → 1.8 g/kg (minimum)', () => {
    const r = calculateProtein(70, 45, 'rest')
    expect(r.g).toBeCloseTo(70 * 1.8, 0)
  })

  it('over-40, moderate day → 2.0 g/kg (midpoint)', () => {
    const r = calculateProtein(70, 45, 'moderate')
    expect(r.g).toBeCloseTo(70 * 2.0, 0)
  })

  it('over-40, hard day → 2.2 g/kg (maximum)', () => {
    const r = calculateProtein(70, 45, 'hard')
    expect(r.g).toBeCloseTo(70 * 2.2, 0)
  })

  it('over-40 exposes correct range', () => {
    const r = calculateProtein(70, 45, 'hard')
    expect(r.range.minGPerKg).toBe(PROTEIN_RANGES.over40.min)
    expect(r.range.maxGPerKg).toBe(PROTEIN_RANGES.over40.max)
  })

  it('age boundary: 39 → under-40 range (max 2.0)', () => {
    const r = calculateProtein(70, 39, 'hard')
    expect(r.range.maxGPerKg).toBe(2.0)
  })

  it('age boundary: 40 → over-40 range (max 2.2)', () => {
    const r = calculateProtein(70, 40, 'hard')
    expect(r.range.maxGPerKg).toBe(2.2)
  })

  it('protein increases monotonically with training load', () => {
    const rest = calculateProtein(70, 30, 'rest').g
    const mod = calculateProtein(70, 30, 'moderate').g
    const hard = calculateProtein(70, 30, 'hard').g
    expect(mod).toBeGreaterThan(rest)
    expect(hard).toBeGreaterThan(mod)
  })

  it('masters athlete has higher protein than young athlete on same day', () => {
    const young = calculateProtein(70, 28, 'hard').g
    const master = calculateProtein(70, 50, 'hard').g
    expect(master).toBeGreaterThan(young)
  })

  it('scales proportionally with weight', () => {
    const p70 = calculateProtein(70, 30, 'moderate').g
    const p85 = calculateProtein(85, 30, 'moderate').g
    expect(p85 / p70).toBeCloseTo(85 / 70, 1)
  })
})

// ── calculateHydration ────────────────────────────────────────────────────────

describe('calculateHydration', () => {
  it('no sessions → base only (35 ml/kg)', () => {
    expect(calculateHydration(70, [])).toBe(70 * HYDRATION_BASE_ML_PER_KG)
  })

  it('only recovery sessions → base only', () => {
    expect(calculateHydration(70, [{ discipline: 'recovery', durationMinutes: 60 }])).toBe(
      70 * HYDRATION_BASE_ML_PER_KG
    )
  })

  it('1 hour of training adds 500–750 ml', () => {
    const base = 70 * HYDRATION_BASE_ML_PER_KG
    const withTraining = calculateHydration(70, [
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z3' },
    ])
    const added = withTraining - base
    expect(added).toBeGreaterThanOrEqual(500)
    expect(added).toBeLessThanOrEqual(750)
  })

  it('higher intensity zone → more hydration per hour', () => {
    const z1 = calculateHydration(70, [
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z1' },
    ])
    const z5 = calculateHydration(70, [
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z5' },
    ])
    expect(z5).toBeGreaterThan(z1)
  })

  it('Z1 hourly hydration = 500 ml (minimum rate)', () => {
    const base = 70 * HYDRATION_BASE_ML_PER_KG
    const with1hrZ1 = calculateHydration(70, [
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z1' },
    ])
    expect(with1hrZ1 - base).toBeCloseTo(500, 0)
  })

  it('2-hour training doubles the training hydration contribution', () => {
    const base = 70 * HYDRATION_BASE_ML_PER_KG
    const oneHr =
      calculateHydration(70, [{ discipline: 'bike', durationMinutes: 60, intensityZone: 'z3' }]) -
      base
    const twoHr =
      calculateHydration(70, [{ discipline: 'bike', durationMinutes: 120, intensityZone: 'z3' }]) -
      base
    // Allow ±1 ml rounding tolerance from Math.round applied to each independently
    expect(Math.abs(twoHr - oneHr * 2)).toBeLessThanOrEqual(1)
  })

  it('scales with body weight', () => {
    const h60 = calculateHydration(60, [])
    const h80 = calculateHydration(80, [])
    expect(h80 / h60).toBeCloseTo(80 / 60, 1)
  })

  it('Ironman training day hydration is substantially higher than rest day', () => {
    const rest = calculateHydration(75, [])
    const bigDay = calculateHydration(75, [
      { discipline: 'swim', durationMinutes: 60, intensityZone: 'z2' },
      { discipline: 'bike', durationMinutes: 180, intensityZone: 'z3' },
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z2' },
    ])
    expect(bigDay).toBeGreaterThan(rest + 1500)
  })
})

// ── calculateMeals ────────────────────────────────────────────────────────────

describe('calculateMeals', () => {
  it('3 meals for protein below threshold (< 80 g)', () => {
    expect(calculateMeals(60)).toHaveLength(3)
  })

  it('4 meals for protein at threshold (= 80 g)', () => {
    expect(calculateMeals(MEALS_HIGH_PROTEIN_THRESHOLD_G)).toHaveLength(4)
  })

  it('4 meals for high protein (160 g)', () => {
    expect(calculateMeals(160)).toHaveLength(4)
  })

  it('meal indices are 1-indexed and sequential', () => {
    const meals = calculateMeals(90)
    expect(meals[0]!.meal).toBe(1)
    expect(meals[1]!.meal).toBe(2)
    expect(meals[2]!.meal).toBe(3)
    expect(meals[3]!.meal).toBe(4)
  })

  it('each meal is ≥ MIN_MEAL_PROTEIN_G (20 g)', () => {
    for (const totalProtein of [30, 50, 60, 80, 120, 160]) {
      const meals = calculateMeals(totalProtein)
      for (const m of meals) {
        expect(m.proteinG).toBeGreaterThanOrEqual(MIN_MEAL_PROTEIN_G)
      }
    }
  })

  it('meals are evenly distributed (all same amount)', () => {
    const meals = calculateMeals(120)
    const first = meals[0]!.proteinG
    for (const m of meals) {
      expect(m.proteinG).toBeCloseTo(first, 0)
    }
  })

  it('very low protein (30 g) → minimum 20 g enforced per meal', () => {
    const meals = calculateMeals(30)
    for (const m of meals) {
      expect(m.proteinG).toBeGreaterThanOrEqual(20)
    }
  })

  it('larger protein input yields larger per-meal portion (3-meal case)', () => {
    const lo = calculateMeals(60)[0]!.proteinG
    const hi = calculateMeals(75)[0]!.proteinG
    expect(hi).toBeGreaterThan(lo)
  })
})

// ── calculateDailyMacros — integration ───────────────────────────────────────

describe('calculateDailyMacros', () => {
  // Representative athlete profiles
  const young: NutritionAthleteProfile = {
    weightKg: 65,
    age: 28,
    dietType: 'vegan',
    experienceLevel: 'beginner',
  }
  const master: NutritionAthleteProfile = {
    weightKg: 80,
    age: 48,
    dietType: 'omnivore',
    experienceLevel: 'advanced',
  }
  const elite: NutritionAthleteProfile = {
    weightKg: 58,
    age: 33,
    dietType: 'vegan',
    experienceLevel: 'elite',
  }
  const lightweight40: NutritionAthleteProfile = {
    weightKg: 55,
    age: 41,
    dietType: 'vegetarian',
    experienceLevel: 'intermediate',
  }

  // ── day-type classification ────────────────────────────────────────────────

  it('no sessions → rest day type', () => {
    expect(calculateDailyMacros(young, []).dayType).toBe('rest')
  })

  it('z4 session → hard day type', () => {
    expect(
      calculateDailyMacros(young, [{ discipline: 'run', durationMinutes: 45, intensityZone: 'z4' }])
        .dayType
    ).toBe('hard')
  })

  // ── CHO is within periodization range ─────────────────────────────────────

  it('rest day CHO in [3, 4] g/kg', () => {
    const r = calculateDailyMacros(young, [])
    const gPerKg = r.carbsG / young.weightKg
    expect(gPerKg).toBeGreaterThanOrEqual(CHO_RANGES.rest.min)
    expect(gPerKg).toBeLessThanOrEqual(CHO_RANGES.rest.max)
  })

  it('hard day CHO in [8, 12] g/kg', () => {
    const r = calculateDailyMacros(master, [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z4' },
    ])
    const gPerKg = r.carbsG / master.weightKg
    expect(gPerKg).toBeGreaterThanOrEqual(CHO_RANGES.hard.min)
    expect(gPerKg).toBeLessThanOrEqual(CHO_RANGES.hard.max)
  })

  it('Ironman long training day → hard CHO range', () => {
    const r = calculateDailyMacros(master, [
      { discipline: 'swim', durationMinutes: 60, intensityZone: 'z3' },
      { discipline: 'bike', durationMinutes: 180, intensityZone: 'z3' },
      { discipline: 'run', durationMinutes: 45, intensityZone: 'z2' },
    ])
    expect(r.dayType).toBe('hard')
    expect(r.carbsG / master.weightKg).toBeGreaterThanOrEqual(8)
    expect(r.carbsG / master.weightKg).toBeLessThanOrEqual(12)
  })

  it('sprint race day → hard with high CHO', () => {
    const r = calculateDailyMacros(elite, [
      { discipline: 'swim', durationMinutes: 20, intensityZone: 'z5' },
      { discipline: 'brick', durationMinutes: 55, intensityZone: 'z4' },
    ])
    expect(r.dayType).toBe('hard')
    expect(r.carbsG / elite.weightKg).toBeGreaterThanOrEqual(8)
  })

  // ── Protein rules ─────────────────────────────────────────────────────────

  it('under-40 athlete protein is within [1.6, 2.0] g/kg', () => {
    for (const dayType of ['rest', 'light', 'moderate', 'hard'] as const) {
      const sessions: SessionInput[] =
        dayType === 'hard' ? [{ discipline: 'run', durationMinutes: 45, intensityZone: 'z4' }] : []
      const r = calculateDailyMacros(young, sessions)
      const gPerKg = r.proteinG / young.weightKg
      expect(gPerKg).toBeGreaterThanOrEqual(1.6 - 0.01)
      expect(gPerKg).toBeLessThanOrEqual(2.0 + 0.01)
    }
  })

  it('over-40 athlete has higher protein than same-weight under-40 on same day', () => {
    const sessions: SessionInput[] = [
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z4' },
    ]
    const youngResult = calculateDailyMacros({ ...young, age: 35, weightKg: 75 }, sessions)
    const masterResult = calculateDailyMacros({ ...master, age: 50, weightKg: 75 }, sessions)
    expect(masterResult.proteinG).toBeGreaterThan(youngResult.proteinG)
  })

  // ── Fat minimum ────────────────────────────────────────────────────────────

  it('fat is always ≥ 0.8 g/kg (minimum fat rule)', () => {
    const testCases: SessionInput[][] = [
      [],
      [{ discipline: 'run', durationMinutes: 60, intensityZone: 'z2' }],
      [{ discipline: 'bike', durationMinutes: 180, intensityZone: 'z5' }],
      [
        { discipline: 'swim', durationMinutes: 60, intensityZone: 'z3' },
        { discipline: 'bike', durationMinutes: 180, intensityZone: 'z4' },
        { discipline: 'run', durationMinutes: 60, intensityZone: 'z3' },
      ],
    ]
    for (const sessions of testCases) {
      const r = calculateDailyMacros(young, sessions)
      expect(r.fatG).toBeGreaterThanOrEqual(FAT_MIN_G_PER_KG * young.weightKg - 0.1)
    }
  })

  it('fat minimum holds for lightweight masters athlete', () => {
    const r = calculateDailyMacros(lightweight40, [
      { discipline: 'bike', durationMinutes: 180, intensityZone: 'z4' },
    ])
    expect(r.fatG).toBeGreaterThanOrEqual(FAT_MIN_G_PER_KG * lightweight40.weightKg - 0.1)
  })

  // ── Total kcal accounting ──────────────────────────────────────────────────

  it('total kcal = carbs×4 + protein×4 + fat×9 (macro accounting)', () => {
    const r = calculateDailyMacros(master, [
      { discipline: 'bike', durationMinutes: 120, intensityZone: 'z4' },
    ])
    const computed = r.carbsG * 4 + r.proteinG * 4 + r.fatG * 9
    expect(Math.abs(r.totalKcal - computed)).toBeLessThan(1)
  })

  it('total kcal accounting holds on rest day', () => {
    const r = calculateDailyMacros(young, [])
    const computed = r.carbsG * 4 + r.proteinG * 4 + r.fatG * 9
    expect(Math.abs(r.totalKcal - computed)).toBeLessThan(1)
  })

  it('total kcal accounting holds on Ironman training day', () => {
    const r = calculateDailyMacros(elite, [
      { discipline: 'swim', durationMinutes: 60, intensityZone: 'z2' },
      { discipline: 'bike', durationMinutes: 240, intensityZone: 'z3' },
      { discipline: 'run', durationMinutes: 60, intensityZone: 'z2' },
    ])
    const computed = r.carbsG * 4 + r.proteinG * 4 + r.fatG * 9
    expect(Math.abs(r.totalKcal - computed)).toBeLessThan(1)
  })

  // ── Training day scale-up ─────────────────────────────────────────────────

  it('hard day has more carbs than rest day (same athlete)', () => {
    const rest = calculateDailyMacros(young, [])
    const hard = calculateDailyMacros(young, [
      { discipline: 'run', durationMinutes: 90, intensityZone: 'z4' },
    ])
    expect(hard.carbsG).toBeGreaterThan(rest.carbsG)
  })

  it('total kcal increases from rest to hard training day', () => {
    const rest = calculateDailyMacros(master, [])
    const hard = calculateDailyMacros(master, [
      { discipline: 'bike', durationMinutes: 180, intensityZone: 'z4' },
    ])
    expect(hard.totalKcal).toBeGreaterThan(rest.totalKcal)
  })

  it('hard day has higher hydration than rest day', () => {
    const rest = calculateDailyMacros(young, [])
    const hard = calculateDailyMacros(young, [
      { discipline: 'bike', durationMinutes: 90, intensityZone: 'z4' },
    ])
    expect(hard.hydrationMl).toBeGreaterThan(rest.hydrationMl)
  })

  // ── Meal distribution ──────────────────────────────────────────────────────

  it('returns 3 or 4 meals', () => {
    const r = calculateDailyMacros(young, [])
    expect(r.meals.length).toBeGreaterThanOrEqual(3)
    expect(r.meals.length).toBeLessThanOrEqual(4)
  })

  it('all meals have ≥ 20 g protein', () => {
    for (const profile of [young, master, elite, lightweight40]) {
      const r = calculateDailyMacros(profile, [])
      for (const meal of r.meals) {
        expect(meal.proteinG).toBeGreaterThanOrEqual(MIN_MEAL_PROTEIN_G)
      }
    }
  })

  it('heavy athlete on hard day uses 4 meals', () => {
    // 80 kg master on hard day: protein = 2.2 × 80 = 176 g ≥ 80 g threshold
    const r = calculateDailyMacros(master, [
      { discipline: 'bike', durationMinutes: 60, intensityZone: 'z4' },
    ])
    expect(r.meals).toHaveLength(4)
  })

  // ── Range fields ───────────────────────────────────────────────────────────

  it('returns carbsRange matching CHO_RANGES for dayType', () => {
    const r = calculateDailyMacros(young, [])
    expect(r.carbsRange.minGPerKg).toBe(CHO_RANGES[r.dayType].min)
    expect(r.carbsRange.maxGPerKg).toBe(CHO_RANGES[r.dayType].max)
  })

  it('returns proteinRange for correct age group', () => {
    const r = calculateDailyMacros(young, []) // age 28 → under40
    expect(r.proteinRange.minGPerKg).toBe(PROTEIN_RANGES.under40.min)
    expect(r.proteinRange.maxGPerKg).toBe(PROTEIN_RANGES.under40.max)

    const rMaster = calculateDailyMacros(master, []) // age 48 → over40
    expect(rMaster.proteinRange.minGPerKg).toBe(PROTEIN_RANGES.over40.min)
    expect(rMaster.proteinRange.maxGPerKg).toBe(PROTEIN_RANGES.over40.max)
  })

  // ── All profile combinations (smoke tests) ────────────────────────────────

  it('returns positive values for all athlete profile × day-type combinations', () => {
    const profiles: NutritionAthleteProfile[] = [
      { weightKg: 55, age: 25, dietType: 'vegan', experienceLevel: 'beginner' },
      { weightKg: 70, age: 35, dietType: 'vegetarian', experienceLevel: 'intermediate' },
      { weightKg: 80, age: 45, dietType: 'omnivore', experienceLevel: 'advanced' },
      { weightKg: 65, age: 55, dietType: 'vegan', experienceLevel: 'elite' },
    ]
    const sessionSets: SessionInput[][] = [
      [],
      [{ discipline: 'swim', durationMinutes: 30, intensityZone: 'z1' }],
      [{ discipline: 'bike', durationMinutes: 60, intensityZone: 'z2' }],
      [{ discipline: 'run', durationMinutes: 60, intensityZone: 'z4' }],
    ]
    for (const profile of profiles) {
      for (const sessions of sessionSets) {
        const r = calculateDailyMacros(profile, sessions)
        expect(r.carbsG).toBeGreaterThan(0)
        expect(r.proteinG).toBeGreaterThan(0)
        expect(r.fatG).toBeGreaterThan(0)
        expect(r.totalKcal).toBeGreaterThan(0)
        expect(r.hydrationMl).toBeGreaterThan(0)
        expect(r.meals.length).toBeGreaterThan(0)
      }
    }
  })
})
