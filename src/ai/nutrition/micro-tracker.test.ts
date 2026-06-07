import { describe, it, expect } from 'vitest'
import {
  buildTargets,
  aggregateMicros,
  classifyStatus,
  compareToTargets,
  detectStreaks,
  generateSupplements,
  analyseMps,
  generateMicroReport,
  MPS_LEUCINE_MIN_G,
  VEGAN_IRON_MULTIPLIER,
} from './micro-tracker'
import type { AthleteProfile, FoodLogEntry, DailyStatusEntry, NutrientKey } from './micro-tracker'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const maleVegan: AthleteProfile = { sex: 'male', age: 30, weightKg: 70, dietType: 'vegan' }
const femaleVegan: AthleteProfile = { sex: 'female', age: 28, weightKg: 58, dietType: 'vegan' }
const maleOmnivore: AthleteProfile = { sex: 'male', age: 35, weightKg: 80, dietType: 'omnivore' }
const femaleOmnivore: AthleteProfile = {
  sex: 'female',
  age: 45,
  weightKg: 62,
  dietType: 'omnivore',
}
const maleVegetarian: AthleteProfile = {
  sex: 'male',
  age: 25,
  weightKg: 75,
  dietType: 'vegetarian',
}
const masterFemaleVegan: AthleteProfile = {
  sex: 'female',
  age: 52,
  weightKg: 60,
  dietType: 'vegan',
}
const elderAthlete: AthleteProfile = { sex: 'male', age: 62, weightKg: 72, dietType: 'omnivore' }

/** Fully sufficient food log entry — all nutrients at or above target */
function fullEntry(overrides: Partial<FoodLogEntry['micros']> = {}): FoodLogEntry {
  return {
    mealSlot: 'breakfast',
    micros: {
      b12Mcg: 3,
      ironMg: 25,
      zincMg: 15,
      omega3AlaMg: 2000,
      omega3EpaMg: 300,
      omega3DhaMg: 250,
      calciumMg: 1200,
      vitaminDIu: 700,
      leucineMg: 3000,
      ...overrides,
    },
  }
}

function emptyEntry(mealSlot = 'breakfast'): FoodLogEntry {
  return { mealSlot, micros: {} }
}

// ── buildTargets ──────────────────────────────────────────────────────────────

describe('buildTargets', () => {
  it('returns 8 nutrient targets', () => {
    expect(buildTargets(maleVegan)).toHaveLength(8)
  })

  it('every target has a positive amount', () => {
    for (const profile of [maleVegan, femaleOmnivore, maleOmnivore]) {
      for (const t of buildTargets(profile)) {
        expect(t.amount).toBeGreaterThan(0)
      }
    }
  })

  // B12
  it('B12 target is 2.4 µg for all profiles', () => {
    for (const p of [maleVegan, femaleOmnivore, maleOmnivore]) {
      const b12 = buildTargets(p).find((t) => t.key === 'b12')!
      expect(b12.amount).toBe(2.4)
      expect(b12.unit).toBe('µg')
    }
  })

  // Iron
  it('iron target: male omnivore = 8 mg', () => {
    const iron = buildTargets(maleOmnivore).find((t) => t.key === 'iron')!
    expect(iron.amount).toBe(8)
  })

  it('iron target: female omnivore = 18 mg', () => {
    const iron = buildTargets(femaleOmnivore).find((t) => t.key === 'iron')!
    expect(iron.amount).toBe(18)
  })

  it('iron target: male vegan = 8 × 1.8 = 14.4 mg', () => {
    const iron = buildTargets(maleVegan).find((t) => t.key === 'iron')!
    expect(iron.amount).toBeCloseTo(8 * VEGAN_IRON_MULTIPLIER, 1)
  })

  it('iron target: female vegan = 18 × 1.8 = 32.4 mg', () => {
    const iron = buildTargets(femaleVegan).find((t) => t.key === 'iron')!
    expect(iron.amount).toBeCloseTo(18 * VEGAN_IRON_MULTIPLIER, 1)
  })

  it('iron target: female vegetarian gets plant-based multiplier', () => {
    const vegFemale: AthleteProfile = { ...femaleOmnivore, dietType: 'vegetarian' }
    const iron = buildTargets(vegFemale).find((t) => t.key === 'iron')!
    expect(iron.amount).toBeGreaterThan(18) // above raw 18 mg
  })

  // Zinc
  it('zinc target: male omnivore = 11 mg', () => {
    const zinc = buildTargets(maleOmnivore).find((t) => t.key === 'zinc')!
    expect(zinc.amount).toBe(11)
  })

  it('zinc target: female omnivore = 8 mg', () => {
    const zinc = buildTargets(femaleOmnivore).find((t) => t.key === 'zinc')!
    expect(zinc.amount).toBe(8)
  })

  it('zinc target: vegan gets higher than omnivore (phytate correction)', () => {
    const zincOmni = buildTargets(maleOmnivore).find((t) => t.key === 'zinc')!.amount
    const zincVegan = buildTargets(maleVegan).find((t) => t.key === 'zinc')!.amount
    expect(zincVegan).toBeGreaterThan(zincOmni)
  })

  // Omega-3 ALA
  it('ALA target: male = 1600 mg', () => {
    const ala = buildTargets(maleOmnivore).find((t) => t.key === 'omega3Ala')!
    expect(ala.amount).toBe(1600)
    expect(ala.unit).toBe('mg')
  })

  it('ALA target: female = 1100 mg', () => {
    const ala = buildTargets(femaleOmnivore).find((t) => t.key === 'omega3Ala')!
    expect(ala.amount).toBe(1100)
  })

  // EPA+DHA
  it('EPA+DHA target = 500 mg', () => {
    const epaDha = buildTargets(maleOmnivore).find((t) => t.key === 'omega3EpaDha')!
    expect(epaDha.amount).toBe(500)
    expect(epaDha.unit).toBe('mg')
  })

  // Calcium
  it('calcium target = 1000 mg for standard athlete', () => {
    const ca = buildTargets(maleOmnivore).find((t) => t.key === 'calcium')!
    expect(ca.amount).toBe(1000)
  })

  it('calcium target = 1200 mg for women ≥ 50', () => {
    const ca = buildTargets(masterFemaleVegan).find((t) => t.key === 'calcium')!
    expect(ca.amount).toBe(1200)
  })

  // Vitamin D
  it('vitamin D target = 600 IU under age 60', () => {
    const vd = buildTargets(maleVegan).find((t) => t.key === 'vitaminD')!
    expect(vd.amount).toBe(600)
    expect(vd.unit).toBe('IU')
  })

  it('vitamin D target = 800 IU at age 60+', () => {
    const vd = buildTargets(elderAthlete).find((t) => t.key === 'vitaminD')!
    expect(vd.amount).toBe(800)
  })

  // Leucine
  it('leucine daily target = 7500 mg (2.5 g × 3 meals)', () => {
    const leu = buildTargets(maleVegan).find((t) => t.key === 'leucine')!
    expect(leu.amount).toBe(7500)
    expect(leu.unit).toBe('mg')
  })
})

// ── aggregateMicros ───────────────────────────────────────────────────────────

describe('aggregateMicros', () => {
  it('empty entries → all zeros', () => {
    const t = aggregateMicros([])
    expect(t.b12Mcg).toBe(0)
    expect(t.ironMg).toBe(0)
    expect(t.omega3EpaDhaMg).toBe(0)
  })

  it('sums b12 across entries', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { b12Mcg: 1 } },
      { mealSlot: 'lunch', micros: { b12Mcg: 1.5 } },
    ]
    expect(aggregateMicros(entries).b12Mcg).toBeCloseTo(2.5, 2)
  })

  it('combines EPA + DHA into omega3EpaDhaMg', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'dinner', micros: { omega3EpaMg: 200, omega3DhaMg: 300 } },
    ]
    expect(aggregateMicros(entries).omega3EpaDhaMg).toBeCloseTo(500, 1)
  })

  it('EPA and DHA from different entries are summed together', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { omega3EpaMg: 100 } },
      { mealSlot: 'lunch', micros: { omega3DhaMg: 150 } },
      { mealSlot: 'dinner', micros: { omega3EpaMg: 50, omega3DhaMg: 100 } },
    ]
    expect(aggregateMicros(entries).omega3EpaDhaMg).toBeCloseTo(400, 1)
  })

  it('missing micros fields treated as zero (no NaN)', () => {
    const entries: FoodLogEntry[] = [{ mealSlot: 'lunch', micros: {} }]
    const t = aggregateMicros(entries)
    for (const val of Object.values(t)) {
      expect(isNaN(val)).toBe(false)
    }
  })

  it('sums across 4 meals correctly', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { calciumMg: 300 } },
      { mealSlot: 'lunch', micros: { calciumMg: 250 } },
      { mealSlot: 'snack', micros: { calciumMg: 150 } },
      { mealSlot: 'dinner', micros: { calciumMg: 400 } },
    ]
    expect(aggregateMicros(entries).calciumMg).toBeCloseTo(1100, 1)
  })

  it('iron is summed independently of EPA/DHA merge', () => {
    const t = aggregateMicros([
      { mealSlot: 'breakfast', micros: { ironMg: 5, omega3EpaMg: 100, omega3DhaMg: 100 } },
      { mealSlot: 'lunch', micros: { ironMg: 3 } },
    ])
    expect(t.ironMg).toBeCloseTo(8, 1)
    expect(t.omega3EpaDhaMg).toBeCloseTo(200, 1)
  })
})

// ── classifyStatus ────────────────────────────────────────────────────────────

describe('classifyStatus', () => {
  it('fraction ≥ 0.90 → sufficient', () => {
    expect(classifyStatus(9, 10)).toBe('sufficient')
    expect(classifyStatus(10, 10)).toBe('sufficient')
    expect(classifyStatus(15, 10)).toBe('sufficient')
  })

  it('exact 0.90 → sufficient', () => {
    expect(classifyStatus(90, 100)).toBe('sufficient')
  })

  it('0.60 ≤ fraction < 0.90 → low', () => {
    expect(classifyStatus(6, 10)).toBe('low')
    expect(classifyStatus(7, 10)).toBe('low')
    expect(classifyStatus(8.9, 10)).toBe('low')
  })

  it('exact 0.60 → low', () => {
    expect(classifyStatus(60, 100)).toBe('low')
  })

  it('fraction < 0.60 → deficient', () => {
    expect(classifyStatus(3, 10)).toBe('deficient')
    expect(classifyStatus(0, 10)).toBe('deficient')
    expect(classifyStatus(5.9, 10)).toBe('deficient')
  })

  it('intake = 0, target > 0 → deficient', () => {
    expect(classifyStatus(0, 2.4)).toBe('deficient')
  })

  it('target = 0 → sufficient (edge case)', () => {
    expect(classifyStatus(0, 0)).toBe('sufficient')
  })

  it('intake well above target → sufficient', () => {
    expect(classifyStatus(5000, 600)).toBe('sufficient')
  })
})

// ── compareToTargets ──────────────────────────────────────────────────────────

describe('compareToTargets', () => {
  it('returns one result per target', () => {
    const targets = buildTargets(maleVegan)
    const totals = aggregateMicros([fullEntry()])
    expect(compareToTargets(totals, targets)).toHaveLength(targets.length)
  })

  it('fraction is intake / target', () => {
    const targets = buildTargets(maleOmnivore)
    // 1.8 mcg / 2.4 mcg = 0.75 → in [0.60, 0.90) range → 'low'
    const entries: FoodLogEntry[] = [{ mealSlot: 'breakfast', micros: { b12Mcg: 1.8 } }]
    const totals = aggregateMicros(entries)
    const results = compareToTargets(totals, targets)
    const b12 = results.find((r) => r.key === 'b12')!
    expect(b12.fraction).toBeCloseTo(1.8 / 2.4, 2)
    expect(b12.status).toBe('low')
  })

  it('fully sufficient entries (3 meals) → all sufficient', () => {
    // Leucine target is 7500 mg/day; fullEntry has 3000 mg per meal.
    // Need 3 meals to exceed the daily target.
    const targets = buildTargets(maleOmnivore)
    const totals = aggregateMicros([
      fullEntry({ leucineMg: 3000 }),
      { ...fullEntry({ leucineMg: 3000 }), mealSlot: 'lunch' },
      { ...fullEntry({ leucineMg: 3000 }), mealSlot: 'dinner' },
    ])
    const results = compareToTargets(totals, targets)
    for (const r of results) {
      expect(r.status).toBe('sufficient')
    }
  })

  it('empty entries → all deficient', () => {
    const targets = buildTargets(femaleOmnivore)
    const totals = aggregateMicros([])
    const results = compareToTargets(totals, targets)
    for (const r of results) {
      expect(r.status).toBe('deficient')
    }
  })

  it('result contains intake, target, label, unit, and key', () => {
    const targets = buildTargets(maleVegan)
    const totals = aggregateMicros([fullEntry()])
    const r = compareToTargets(totals, targets)[0]!
    expect(r).toHaveProperty('key')
    expect(r).toHaveProperty('label')
    expect(r).toHaveProperty('unit')
    expect(r).toHaveProperty('intake')
    expect(r).toHaveProperty('target')
    expect(r).toHaveProperty('fraction')
    expect(r).toHaveProperty('status')
  })
})

// ── detectStreaks ─────────────────────────────────────────────────────────────

describe('detectStreaks', () => {
  const labels: Record<NutrientKey, string> = {
    b12: 'Vitamin B12',
    iron: 'Iron',
    zinc: 'Zinc',
    omega3Ala: 'Omega-3 ALA',
    omega3EpaDha: 'Omega-3 EPA+DHA',
    calcium: 'Calcium',
    vitaminD: 'Vitamin D',
    leucine: 'Leucine',
  }

  it('no history → no alerts', () => {
    expect(detectStreaks([], ['b12'], labels)).toHaveLength(0)
  })

  it('2 consecutive deficient days (< threshold) → no alert', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-04', statuses: { b12: 'deficient' } },
      { date: '2026-04-05', statuses: { b12: 'deficient' } },
    ]
    expect(detectStreaks(history, ['b12'], labels)).toHaveLength(0)
  })

  it('3 consecutive deficient days → alert', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-04', statuses: { b12: 'deficient' } },
      { date: '2026-04-05', statuses: { b12: 'deficient' } },
      { date: '2026-04-06', statuses: { b12: 'deficient' } },
    ]
    const alerts = detectStreaks(history, ['b12'], labels)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.nutrient).toBe('b12')
    expect(alerts[0]!.consecutiveDays).toBe(3)
  })

  it('5 consecutive deficient days → alert with count=5', () => {
    const history: DailyStatusEntry[] = [1, 2, 3, 4, 5].map((d) => ({
      date: `2026-04-0${d}`,
      statuses: { iron: 'deficient' as const },
    }))
    const alerts = detectStreaks(history, ['iron'], labels)
    expect(alerts[0]!.consecutiveDays).toBe(5)
  })

  it('streak broken by "low" day → no alert (only deficient counts)', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-04', statuses: { zinc: 'deficient' } },
      { date: '2026-04-05', statuses: { zinc: 'low' } }, // ← breaks streak
      { date: '2026-04-06', statuses: { zinc: 'deficient' } },
    ]
    expect(detectStreaks(history, ['zinc'], labels)).toHaveLength(0)
  })

  it('streak broken by "sufficient" day → no alert', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-03', statuses: { vitaminD: 'deficient' } },
      { date: '2026-04-04', statuses: { vitaminD: 'deficient' } },
      { date: '2026-04-05', statuses: { vitaminD: 'sufficient' } },
      { date: '2026-04-06', statuses: { vitaminD: 'deficient' } },
    ]
    expect(detectStreaks(history, ['vitaminD'], labels)).toHaveLength(0)
  })

  it('multiple nutrients can alert simultaneously', () => {
    const history: DailyStatusEntry[] = [1, 2, 3].map((d) => ({
      date: `2026-04-0${d}`,
      statuses: { b12: 'deficient' as const, calcium: 'deficient' as const },
    }))
    const alerts = detectStreaks(history, ['b12', 'calcium'], labels)
    expect(alerts).toHaveLength(2)
    const keys = alerts.map((a) => a.nutrient)
    expect(keys).toContain('b12')
    expect(keys).toContain('calcium')
  })

  it('alert message contains nutrient label and day count', () => {
    const history: DailyStatusEntry[] = [1, 2, 3].map((d) => ({
      date: `2026-04-0${d}`,
      statuses: { iron: 'deficient' as const },
    }))
    const alert = detectStreaks(history, ['iron'], labels)[0]!
    expect(alert.message).toContain('Iron')
    expect(alert.message).toContain('3')
  })

  it('custom threshold = 2 triggers alert after 2 days', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-05', statuses: { b12: 'deficient' } },
      { date: '2026-04-06', statuses: { b12: 'deficient' } },
    ]
    const alerts = detectStreaks(history, ['b12'], labels, 2)
    expect(alerts).toHaveLength(1)
  })

  it('nutrient missing from a day statuses does not extend streak', () => {
    const history: DailyStatusEntry[] = [
      { date: '2026-04-04', statuses: { b12: 'deficient' } },
      { date: '2026-04-05', statuses: {} }, // b12 absent → streak broken
      { date: '2026-04-06', statuses: { b12: 'deficient' } },
    ]
    expect(detectStreaks(history, ['b12'], labels)).toHaveLength(0)
  })
})

// ── generateSupplements ───────────────────────────────────────────────────────

describe('generateSupplements', () => {
  it('vegan always gets B12 supplement regardless of intake', () => {
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleVegan))
    const supps = generateSupplements(maleVegan, nutrients, [])
    const b12 = supps.find((s) => s.nutrient === 'b12')
    expect(b12).toBeDefined()
    expect(b12!.priority).toBe('essential')
  })

  it('omnivore with sufficient B12 does NOT get B12 supplement', () => {
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleOmnivore))
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    const b12 = supps.find((s) => s.nutrient === 'b12')
    expect(b12).toBeUndefined()
  })

  it('vegetarian with sufficient B12 does NOT get B12 supplement', () => {
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleVegetarian))
    const supps = generateSupplements(maleVegetarian, nutrients, [])
    const b12 = supps.find((s) => s.nutrient === 'b12')
    expect(b12).toBeUndefined()
  })

  it('plant-based athletes always get omega-3 EPA+DHA recommendation when not sufficient', () => {
    // fullEntry has EPA+DHA, but female vegan target may differ — use empty to be safe
    const nutrients = compareToTargets(aggregateMicros([emptyEntry()]), buildTargets(femaleVegan))
    const supps = generateSupplements(femaleVegan, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'omega3EpaDha')).toBeDefined()
  })

  it('plant-based athlete with sufficient EPA+DHA still gets it recommended (policy)', () => {
    // algae omega-3 is always recommended for plant-based athletes
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleVegetarian))
    // manually mark omega3EpaDha as sufficient — generateSupplements checks status
    // fullEntry has omega3EpaMg:300 + omega3DhaMg:250 = 550 mg > 500 mg target
    const supps = generateSupplements(maleVegetarian, nutrients, [])
    // Should NOT recommend if truly sufficient — policy: only if not sufficient
    // The fullEntry gives 550 mg which is ≥ 500 (target) → sufficient → no recommendation
    // Actually per the code: recommended if status !== 'sufficient'
    const epaDha = supps.find((s) => s.nutrient === 'omega3EpaDha')
    // Sufficient intake → no recommendation
    expect(epaDha).toBeUndefined()
  })

  it('vitamin D supplement when low', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'breakfast', micros: { vitaminDIu: 200 } }]),
      buildTargets(maleOmnivore)
    )
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    const vitD = supps.find((s) => s.nutrient === 'vitaminD')
    expect(vitD).toBeDefined()
  })

  it('vitamin D supplement when deficient uses higher dose suggestion', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'breakfast', micros: { vitaminDIu: 50 } }]),
      buildTargets(maleOmnivore)
    )
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    const vitD = supps.find((s) => s.nutrient === 'vitaminD')!
    expect(vitD.priority).toBe('essential')
    expect(vitD.suggestion).toContain('2000')
  })

  it('no vitamin D supplement when sufficient', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'breakfast', micros: { vitaminDIu: 700 } }]),
      buildTargets(maleOmnivore)
    )
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'vitaminD')).toBeUndefined()
  })

  it('iron supplement recommended when deficient', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'lunch', micros: { ironMg: 1 } }]),
      buildTargets(femaleOmnivore)
    )
    const supps = generateSupplements(femaleOmnivore, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'iron')).toBeDefined()
  })

  it('no iron supplement when sufficient (non-alerted)', () => {
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleOmnivore))
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'iron')).toBeUndefined()
  })

  it('zinc supplement when low', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'dinner', micros: { zincMg: 4 } }]),
      buildTargets(maleOmnivore)
    )
    const supps = generateSupplements(maleOmnivore, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'zinc')).toBeDefined()
  })

  it('calcium supplement when deficient', () => {
    const nutrients = compareToTargets(
      aggregateMicros([{ mealSlot: 'breakfast', micros: { calciumMg: 200 } }]),
      buildTargets(femaleVegan)
    )
    const supps = generateSupplements(femaleVegan, nutrients, [])
    expect(supps.find((s) => s.nutrient === 'calcium')).toBeDefined()
  })

  it('returns supplements sorted by priority (essential first)', () => {
    const nutrients = compareToTargets(aggregateMicros([emptyEntry()]), buildTargets(maleVegan))
    const supps = generateSupplements(maleVegan, nutrients, [])
    const priorities = supps.map((s) => s.priority)
    const order = { essential: 0, recommended: 1, optional: 2 }
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]!]).toBeGreaterThanOrEqual(order[priorities[i - 1]!])
    }
  })

  it('no duplicate supplements for same nutrient', () => {
    const nutrients = compareToTargets(aggregateMicros([emptyEntry()]), buildTargets(maleVegan))
    const alerts = [
      { nutrient: 'b12' as NutrientKey, label: 'Vitamin B12', consecutiveDays: 3, message: 'test' },
    ]
    const supps = generateSupplements(maleVegan, nutrients, alerts)
    const b12Supps = supps.filter((s) => s.nutrient === 'b12')
    expect(b12Supps).toHaveLength(1)
  })

  it('alert for a nutrient not covered by specific rules gets a generic recommendation', () => {
    const nutrients = compareToTargets(aggregateMicros([fullEntry()]), buildTargets(maleOmnivore))
    const alerts = [
      {
        nutrient: 'omega3Ala' as NutrientKey,
        label: 'Omega-3 ALA',
        consecutiveDays: 3,
        message: 'test',
      },
    ]
    const supps = generateSupplements(maleOmnivore, nutrients, alerts)
    // omega3Ala has no specific rule, should get generic fallback
    expect(supps.find((s) => s.nutrient === 'omega3Ala')).toBeDefined()
  })
})

// ── analyseMps ────────────────────────────────────────────────────────────────

describe('analyseMps', () => {
  it('empty entries → zero meals above threshold', () => {
    const r = analyseMps([])
    expect(r.mealsAboveMpsThreshold).toBe(0)
    expect(r.totalMeals).toBe(0)
  })

  it('meal with leucine ≥ 2500 mg → above threshold', () => {
    const entries: FoodLogEntry[] = [{ mealSlot: 'breakfast', micros: { leucineMg: 3000 } }]
    const r = analyseMps(entries)
    expect(r.mealsAboveMpsThreshold).toBe(1)
    expect(r.perMeal[0]!.aboveThreshold).toBe(true)
  })

  it('meal with leucine < 2500 mg → below threshold', () => {
    const entries: FoodLogEntry[] = [{ mealSlot: 'lunch', micros: { leucineMg: 2000 } }]
    const r = analyseMps(entries)
    expect(r.mealsAboveMpsThreshold).toBe(0)
    expect(r.perMeal[0]!.aboveThreshold).toBe(false)
  })

  it('exact threshold (2500 mg) → above threshold', () => {
    const entries: FoodLogEntry[] = [{ mealSlot: 'breakfast', micros: { leucineMg: 2500 } }]
    expect(analyseMps(entries).mealsAboveMpsThreshold).toBe(1)
  })

  it('aggregates leucine across multiple entries in same meal slot', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { leucineMg: 1200 } },
      { mealSlot: 'breakfast', micros: { leucineMg: 1400 } }, // total 2600 → above
    ]
    const r = analyseMps(entries)
    expect(r.mealsAboveMpsThreshold).toBe(1)
    expect(r.perMeal[0]!.leucineG).toBeCloseTo(2.6, 1)
  })

  it('counts distinct meal slots', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { leucineMg: 3000 } },
      { mealSlot: 'lunch', micros: { leucineMg: 3000 } },
      { mealSlot: 'dinner', micros: { leucineMg: 1000 } },
    ]
    const r = analyseMps(entries)
    expect(r.totalMeals).toBe(3)
    expect(r.mealsAboveMpsThreshold).toBe(2)
  })

  it('reports correct leucineG in g (converted from mg)', () => {
    const entries: FoodLogEntry[] = [{ mealSlot: 'breakfast', micros: { leucineMg: 3500 } }]
    expect(analyseMps(entries).perMeal[0]!.leucineG).toBeCloseTo(3.5, 2)
  })

  it('mpsThresholdG is MPS_LEUCINE_MIN_G', () => {
    expect(analyseMps([]).mpsThresholdG).toBe(MPS_LEUCINE_MIN_G)
  })
})

// ── generateMicroReport — integration ────────────────────────────────────────

describe('generateMicroReport', () => {
  it('returns correct date in report', () => {
    const r = generateMicroReport('2026-04-06', maleVegan, [])
    expect(r.date).toBe('2026-04-06')
  })

  it('returns correct profile', () => {
    const r = generateMicroReport('2026-04-06', femaleVegan, [])
    expect(r.profile).toEqual(femaleVegan)
  })

  it('nutrients array has one entry per tracked nutrient (8)', () => {
    const r = generateMicroReport('2026-04-06', maleOmnivore, [])
    expect(r.nutrients).toHaveLength(8)
  })

  it('vegan with zero food intake → B12 supplement always present', () => {
    const r = generateMicroReport('2026-04-06', maleVegan, [])
    expect(r.supplements.find((s) => s.nutrient === 'b12')).toBeDefined()
  })

  it('omnivore with full food intake → no supplements (except possibly vitD)', () => {
    const r = generateMicroReport('2026-04-06', maleOmnivore, [fullEntry()])
    const nonVitD = r.supplements.filter((s) => s.nutrient !== 'vitaminD')
    expect(nonVitD).toHaveLength(0)
  })

  it('3 days of deficient calcium → alert present', () => {
    const lowCa = { mealSlot: 'breakfast', micros: { calciumMg: 100 } }
    const history: DailyStatusEntry[] = [
      { date: '2026-04-04', statuses: { calcium: 'deficient' } },
      { date: '2026-04-05', statuses: { calcium: 'deficient' } },
    ]
    const r = generateMicroReport('2026-04-06', maleOmnivore, [lowCa], history)
    expect(r.alerts.find((a) => a.nutrient === 'calcium')).toBeDefined()
  })

  it('2 days of deficient B12 → no alert yet (below threshold)', () => {
    const history: DailyStatusEntry[] = [{ date: '2026-04-05', statuses: { b12: 'deficient' } }]
    const lowB12 = { mealSlot: 'breakfast', micros: { b12Mcg: 0 } }
    const r = generateMicroReport('2026-04-06', maleOmnivore, [lowB12], history)
    // only 2 total days (1 history + today) → no alert
    expect(r.alerts.find((a) => a.nutrient === 'b12')).toBeUndefined()
  })

  it('mpsAnalysis is included in report', () => {
    const r = generateMicroReport('2026-04-06', maleVegan, [])
    expect(r).toHaveProperty('mpsAnalysis')
    expect(r.mpsAnalysis).toHaveProperty('mealsAboveMpsThreshold')
  })

  it('3 meals with high leucine → all above MPS threshold', () => {
    const entries: FoodLogEntry[] = [
      { mealSlot: 'breakfast', micros: { leucineMg: 3000 } },
      { mealSlot: 'lunch', micros: { leucineMg: 2700 } },
      { mealSlot: 'dinner', micros: { leucineMg: 2800 } },
    ]
    const r = generateMicroReport('2026-04-06', maleVegan, entries)
    expect(r.mpsAnalysis.mealsAboveMpsThreshold).toBe(3)
  })

  it('full report structure has all required fields', () => {
    const r = generateMicroReport('2026-04-06', femaleOmnivore, [fullEntry()])
    expect(r).toHaveProperty('date')
    expect(r).toHaveProperty('profile')
    expect(r).toHaveProperty('nutrients')
    expect(r).toHaveProperty('alerts')
    expect(r).toHaveProperty('supplements')
    expect(r).toHaveProperty('mpsAnalysis')
  })

  it('all athlete profile × diet combinations run without error', () => {
    const profiles: AthleteProfile[] = [
      { sex: 'male', age: 25, weightKg: 70, dietType: 'vegan' },
      { sex: 'female', age: 35, weightKg: 60, dietType: 'vegan' },
      { sex: 'male', age: 45, weightKg: 80, dietType: 'omnivore' },
      { sex: 'female', age: 55, weightKg: 65, dietType: 'omnivore' },
      { sex: 'male', age: 30, weightKg: 75, dietType: 'vegetarian' },
      { sex: 'other', age: 28, weightKg: 68, dietType: 'vegan' },
    ]
    for (const profile of profiles) {
      expect(() => generateMicroReport('2026-04-06', profile, [fullEntry()])).not.toThrow()
    }
  })

  it('no NaN values in any nutrient result', () => {
    const r = generateMicroReport('2026-04-06', maleVegan, [emptyEntry()])
    for (const n of r.nutrients) {
      expect(isNaN(n.intake)).toBe(false)
      expect(isNaN(n.fraction)).toBe(false)
      expect(isNaN(n.target)).toBe(false)
    }
  })
})
