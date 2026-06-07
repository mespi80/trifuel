/**
 * Micronutrient tracking module for triathlon athletes.
 *
 * Aggregates daily intake from food log entries, compares against
 * sex/diet-adjusted targets, classifies status per nutrient, detects
 * multi-day deficiency streaks, and generates supplement recommendations.
 *
 * All units match the food_items.micros schema:
 *   b12Mcg, ironMg, zincMg, omega3AlaMg, omega3EpaMg, omega3DhaMg,
 *   calciumMg, vitaminDIu, leucineMg (per food item per meal).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female' | 'other'
export type DietType = 'vegan' | 'vegetarian' | 'omnivore'

/** Nutrient identifiers tracked by this module */
export type NutrientKey =
  | 'b12'
  | 'iron'
  | 'zinc'
  | 'omega3Ala'
  | 'omega3EpaDha'
  | 'calcium'
  | 'vitaminD'
  | 'leucine'

/** Per-nutrient status classification */
export type NutrientStatus = 'sufficient' | 'low' | 'deficient'

/** Micros shape consumed from food_items.micros, scaled by quantity */
export interface FoodLogMicros {
  b12Mcg?: number
  ironMg?: number
  zincMg?: number
  omega3AlaMg?: number
  omega3EpaMg?: number
  omega3DhaMg?: number
  calciumMg?: number
  vitaminDIu?: number
  leucineMg?: number
}

/**
 * A single food log entry — the caller is responsible for joining
 * food_items.micros and scaling by quantity.
 */
export interface FoodLogEntry {
  mealSlot: string
  /** Micros already scaled by quantity (foodItem.micros × quantity) */
  micros: FoodLogMicros
}

export interface AthleteProfile {
  sex: Sex
  age: number
  weightKg: number
  dietType: DietType
}

/** Resolved daily target for a single nutrient */
export interface NutrientTarget {
  key: NutrientKey
  amount: number
  unit: string
  label: string
}

/** Result for one nutrient after comparing intake to target */
export interface NutrientResult {
  key: NutrientKey
  label: string
  unit: string
  intake: number
  target: number
  /** 0–1 fraction of target met */
  fraction: number
  status: NutrientStatus
}

/** A deficiency alert fired when a nutrient is deficient 3+ consecutive days */
export interface DeficiencyAlert {
  nutrient: NutrientKey
  label: string
  consecutiveDays: number
  message: string
}

/** A supplement recommendation */
export interface SupplementRecommendation {
  nutrient: NutrientKey
  label: string
  /** e.g. "1000–2000 IU vitamin D3 daily" */
  suggestion: string
  /** why this supplement is recommended */
  reason: string
  priority: 'essential' | 'recommended' | 'optional'
}

/** Full daily micronutrient report */
export interface MicronutrientReport {
  date: string
  profile: AthleteProfile
  nutrients: NutrientResult[]
  alerts: DeficiencyAlert[]
  supplements: SupplementRecommendation[]
  /** Leucine per-meal MPS threshold analysis */
  mpsAnalysis: MpsAnalysis
}

export interface MpsAnalysis {
  mealsAboveMpsThreshold: number
  totalMeals: number
  mpsThresholdG: number
  perMeal: { mealSlot: string; leucineG: number; aboveThreshold: boolean }[]
}

// ── Targets ───────────────────────────────────────────────────────────────────

/** Consecutive deficient days required before alert is raised */
export const DEFICIENCY_STREAK_THRESHOLD = 3

/** Leucine per-meal threshold for muscle protein synthesis (MPS) */
export const MPS_LEUCINE_MIN_G = 2.5
export const MPS_LEUCINE_MAX_G = 3.0

/**
 * Status thresholds — fraction of target.
 * sufficient: ≥ 0.90 of target
 * low:        0.60–0.89
 * deficient:  < 0.60
 */
export const STATUS_SUFFICIENT_FRACTION = 0.9
export const STATUS_LOW_FRACTION = 0.6

/**
 * Iron absorption correction for plant-based diets.
 * Non-haem iron is absorbed ~1.8× less efficiently.
 */
export const VEGAN_IRON_MULTIPLIER = 1.8

/**
 * Returns daily micronutrient targets adjusted for sex, age, and diet type.
 *
 * Sources: NIH DRI tables, European Food Safety Authority (EFSA) reference values.
 * Vegan iron and zinc targets are pre-multiplied for reduced bioavailability.
 */
export function buildTargets(profile: AthleteProfile): NutrientTarget[] {
  const { sex, age, dietType } = profile
  const isMale = sex === 'male'
  const isVegan = dietType === 'vegan'
  const isVegetarian = dietType === 'vegetarian'
  const isPlantBased = isVegan || isVegetarian

  // B12: 2.4 µg for all; vegans/vegetarians need supplementation regardless
  const b12: NutrientTarget = {
    key: 'b12',
    amount: 2.4,
    unit: 'µg',
    label: 'Vitamin B12',
  }

  // Iron: 18 mg female, 8 mg male; plant-based ×1.8 for non-haem
  const ironBase = isMale ? 8 : 18
  const ironAdjusted = isPlantBased ? ironBase * VEGAN_IRON_MULTIPLIER : ironBase
  const iron: NutrientTarget = {
    key: 'iron',
    amount: round2(ironAdjusted),
    unit: 'mg',
    label: 'Iron',
  }

  // Zinc: 11 mg male, 8 mg female; plant-based ×1.5 (conservative plant-zinc correction)
  const zincBase = isMale ? 11 : 8
  const zincAdjusted = isPlantBased ? round2(zincBase * 1.5) : zincBase
  const zinc: NutrientTarget = {
    key: 'zinc',
    amount: zincAdjusted,
    unit: 'mg',
    label: 'Zinc',
  }

  // Omega-3 ALA: 1.6 g male, 1.1 g female (stored as mg in food items)
  const omega3Ala: NutrientTarget = {
    key: 'omega3Ala',
    amount: isMale ? 1600 : 1100, // mg
    unit: 'mg',
    label: 'Omega-3 ALA',
  }

  // EPA+DHA: 250–500 mg combined; athletes aim for 500 mg
  const omega3EpaDha: NutrientTarget = {
    key: 'omega3EpaDha',
    amount: 500, // mg — upper of recommended range
    unit: 'mg',
    label: 'Omega-3 EPA+DHA',
  }

  // Calcium: 1000 mg (1200 mg for women >50 or athletes, but we keep 1000 as general)
  const calciumAmount = !isMale && age >= 50 ? 1200 : 1000
  const calcium: NutrientTarget = {
    key: 'calcium',
    amount: calciumAmount,
    unit: 'mg',
    label: 'Calcium',
  }

  // Vitamin D: 600–1000 IU; athletes and those >60 at 800 IU
  const vitaminDAmount = age >= 60 ? 800 : 600
  const vitaminD: NutrientTarget = {
    key: 'vitaminD',
    amount: vitaminDAmount,
    unit: 'IU',
    label: 'Vitamin D',
  }

  // Leucine: stored as mg; MPS threshold 2500 mg per meal
  // Daily total target = MPS_LEUCINE_MIN_G × 3 meals (minimum 3 meals for MPS)
  const leucine: NutrientTarget = {
    key: 'leucine',
    amount: MPS_LEUCINE_MIN_G * 3 * 1000, // 7500 mg
    unit: 'mg',
    label: 'Leucine',
  }

  return [b12, iron, zinc, omega3Ala, omega3EpaDha, calcium, vitaminD, leucine]
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface AggregatedMicros {
  b12Mcg: number
  ironMg: number
  zincMg: number
  omega3AlaMg: number
  omega3EpaDhaMg: number
  calciumMg: number
  vitaminDIu: number
  leucineMg: number
}

/**
 * Aggregates all food log entries into a single daily total per nutrient.
 * EPA and DHA are summed into a single omega3EpaDhaMg figure.
 */
export function aggregateMicros(entries: FoodLogEntry[]): AggregatedMicros {
  const totals: AggregatedMicros = {
    b12Mcg: 0,
    ironMg: 0,
    zincMg: 0,
    omega3AlaMg: 0,
    omega3EpaDhaMg: 0,
    calciumMg: 0,
    vitaminDIu: 0,
    leucineMg: 0,
  }

  for (const entry of entries) {
    const m = entry.micros
    totals.b12Mcg += m.b12Mcg ?? 0
    totals.ironMg += m.ironMg ?? 0
    totals.zincMg += m.zincMg ?? 0
    totals.omega3AlaMg += m.omega3AlaMg ?? 0
    totals.omega3EpaDhaMg += (m.omega3EpaMg ?? 0) + (m.omega3DhaMg ?? 0)
    totals.calciumMg += m.calciumMg ?? 0
    totals.vitaminDIu += m.vitaminDIu ?? 0
    totals.leucineMg += m.leucineMg ?? 0
  }

  return {
    b12Mcg: round2(totals.b12Mcg),
    ironMg: round2(totals.ironMg),
    zincMg: round2(totals.zincMg),
    omega3AlaMg: round2(totals.omega3AlaMg),
    omega3EpaDhaMg: round2(totals.omega3EpaDhaMg),
    calciumMg: round2(totals.calciumMg),
    vitaminDIu: round2(totals.vitaminDIu),
    leucineMg: round2(totals.leucineMg),
  }
}

// ── Status Classification ─────────────────────────────────────────────────────

/**
 * Classifies a single nutrient's intake against its target.
 *
 * sufficient: fraction ≥ 0.90
 * low:        0.60 ≤ fraction < 0.90
 * deficient:  fraction < 0.60
 */
export function classifyStatus(intake: number, target: number): NutrientStatus {
  if (target === 0) return 'sufficient'
  const fraction = intake / target
  if (fraction >= STATUS_SUFFICIENT_FRACTION) return 'sufficient'
  if (fraction >= STATUS_LOW_FRACTION) return 'low'
  return 'deficient'
}

/**
 * Compares aggregated intake against computed targets and returns
 * a NutrientResult for each tracked nutrient.
 */
export function compareToTargets(
  totals: AggregatedMicros,
  targets: NutrientTarget[]
): NutrientResult[] {
  return targets.map((t) => {
    let intake: number
    switch (t.key) {
      case 'b12':
        intake = totals.b12Mcg
        break
      case 'iron':
        intake = totals.ironMg
        break
      case 'zinc':
        intake = totals.zincMg
        break
      case 'omega3Ala':
        intake = totals.omega3AlaMg
        break
      case 'omega3EpaDha':
        intake = totals.omega3EpaDhaMg
        break
      case 'calcium':
        intake = totals.calciumMg
        break
      case 'vitaminD':
        intake = totals.vitaminDIu
        break
      case 'leucine':
        intake = totals.leucineMg
        break
    }
    const fraction = t.amount === 0 ? 1 : round2(intake / t.amount)
    return {
      key: t.key,
      label: t.label,
      unit: t.unit,
      intake: round2(intake),
      target: t.amount,
      fraction,
      status: classifyStatus(intake, t.amount),
    }
  })
}

// ── Streak Detection ──────────────────────────────────────────────────────────

/**
 * History entry for a single day — must be provided by the caller in
 * chronological order (oldest to newest), ending at today.
 */
export interface DailyStatusEntry {
  date: string
  statuses: Partial<Record<NutrientKey, NutrientStatus>>
}

/**
 * Detects deficiency streaks across multiple consecutive days.
 * Only looks at the tail of the history (most recent N days) to find
 * current ongoing streaks.
 *
 * A nutrient is flagged if its most recent `DEFICIENCY_STREAK_THRESHOLD`
 * consecutive days are all 'deficient'.
 */
export function detectStreaks(
  history: DailyStatusEntry[],
  keys: NutrientKey[],
  nutrientLabels: Record<NutrientKey, string>,
  thresholdDays = DEFICIENCY_STREAK_THRESHOLD
): DeficiencyAlert[] {
  const alerts: DeficiencyAlert[] = []

  for (const key of keys) {
    let streak = 0
    // Walk backwards through history
    for (let i = history.length - 1; i >= 0; i--) {
      const status = history[i]!.statuses[key]
      if (status === 'deficient') {
        streak++
      } else {
        break
      }
    }

    if (streak >= thresholdDays) {
      alerts.push({
        nutrient: key,
        label: nutrientLabels[key],
        consecutiveDays: streak,
        message: `${nutrientLabels[key]} has been deficient for ${streak} consecutive day${streak === 1 ? '' : 's'}. Consider dietary changes or supplementation.`,
      })
    }
  }

  return alerts
}

// ── Supplement Recommendations ────────────────────────────────────────────────

/**
 * Generates supplement recommendations based on:
 * 1. Diet type (vegans always get B12, always get vitamin D + omega-3 algae)
 * 2. Current day's deficiency/low status per nutrient
 * 3. Multi-day streak alerts
 *
 * Recommendations are de-duplicated (never appears twice for same nutrient).
 */
export function generateSupplements(
  profile: AthleteProfile,
  nutrients: NutrientResult[],
  alerts: DeficiencyAlert[]
): SupplementRecommendation[] {
  const { dietType } = profile
  const isVegan = dietType === 'vegan'
  const isVegetarian = dietType === 'vegetarian'
  const isPlantBased = isVegan || isVegetarian

  const recommended = new Map<NutrientKey, SupplementRecommendation>()

  const statusMap = new Map<NutrientKey, NutrientStatus>(nutrients.map((n) => [n.key, n.status]))
  const alertSet = new Set<NutrientKey>(alerts.map((a) => a.nutrient))

  // ── 1. Always recommend B12 for vegans ────────────────────────────────────
  if (isVegan) {
    recommended.set('b12', {
      nutrient: 'b12',
      label: 'Vitamin B12',
      suggestion: '250–1000 µg cyanocobalamin or methylcobalamin daily, or 2000 µg weekly',
      reason:
        'B12 is absent from plant foods. All vegans require supplementation regardless of fortified food intake.',
      priority: 'essential',
    })
  }

  // ── 2. Omega-3 EPA+DHA for plant-based athletes ───────────────────────────
  if (isPlantBased) {
    const status = statusMap.get('omega3EpaDha')
    if (!status || status !== 'sufficient') {
      recommended.set('omega3EpaDha', {
        nutrient: 'omega3EpaDha',
        label: 'Omega-3 EPA+DHA',
        suggestion: '250–500 mg algae-derived EPA+DHA daily (e.g. Testa, Ovega-3)',
        reason: isVegan
          ? 'EPA and DHA are found almost exclusively in fatty fish. Algae-derived supplements provide the same long-chain omega-3s at the source.'
          : 'Plant-based diets are low in pre-formed EPA+DHA. ALA conversion is inefficient (~5%). Algae oil is the preferred non-fish source.',
        priority: 'essential',
      })
    }
  }

  // ── 3. Vitamin D for all if low or deficient ──────────────────────────────
  const vitDStatus = statusMap.get('vitaminD')
  if (vitDStatus === 'deficient' || vitDStatus === 'low') {
    recommended.set('vitaminD', {
      nutrient: 'vitaminD',
      label: 'Vitamin D',
      suggestion:
        vitDStatus === 'deficient'
          ? '2000–4000 IU vitamin D3 (cholecalciferol) daily; recheck serum 25(OH)D in 3 months'
          : '1000–2000 IU vitamin D3 daily',
      reason:
        'Dietary sources of vitamin D are limited, especially in plant-based diets. Athletes training indoors or at high latitudes are at higher risk of insufficiency.',
      priority: vitDStatus === 'deficient' ? 'essential' : 'recommended',
    })
  }

  // ── 4. Iron if deficient / alert ─────────────────────────────────────────
  const ironStatus = statusMap.get('iron')
  if (ironStatus === 'deficient' || alertSet.has('iron')) {
    recommended.set('iron', {
      nutrient: 'iron',
      label: 'Iron',
      suggestion:
        'Consult a physician before supplementing iron. If prescribed: 14–18 mg elemental iron (ferrous bisglycinate preferred — better tolerated, fewer GI side effects). Take with vitamin C; avoid with calcium or coffee.',
      reason: isPlantBased
        ? 'Non-haem iron from plant foods has lower bioavailability (~5–12% vs 14–18% haem iron). Deficiency is common in plant-based endurance athletes, especially females.'
        : 'Endurance training increases iron losses via haemolysis, sweat, and gut microbleeds. Monitor serum ferritin alongside haemoglobin.',
      priority: 'recommended',
    })
  }

  // ── 5. Zinc if low/deficient or alert ────────────────────────────────────
  const zincStatus = statusMap.get('zinc')
  if (zincStatus === 'deficient' || zincStatus === 'low' || alertSet.has('zinc')) {
    recommended.set('zinc', {
      nutrient: 'zinc',
      label: 'Zinc',
      suggestion:
        '15–25 mg zinc (zinc bisglycinate or picolinate) daily with food. Avoid >40 mg long-term as it interferes with copper absorption.',
      reason: isPlantBased
        ? 'Phytates in legumes, grains, and seeds reduce zinc absorption. Plant-based athletes need up to 50% more dietary zinc.'
        : 'Endurance training increases urinary and sweat zinc losses. Low zinc impairs immune function and testosterone production.',
      priority: zincStatus === 'deficient' || alertSet.has('zinc') ? 'recommended' : 'optional',
    })
  }

  // ── 6. Calcium if deficient or alert ─────────────────────────────────────
  const calciumStatus = statusMap.get('calcium')
  if (calciumStatus === 'deficient' || alertSet.has('calcium')) {
    recommended.set('calcium', {
      nutrient: 'calcium',
      label: 'Calcium',
      suggestion:
        '500–600 mg calcium (calcium citrate, twice daily with meals). Split doses — absorption is capped at ~500 mg per intake.',
      reason: isVegan
        ? 'Dairy-free diets can fall short of calcium. Fortified plant milks and tofu made with calcium sulfate are the best food sources, but supplementation is often needed.'
        : 'Ensure adequate calcium intake to support bone density under training load.',
      priority: 'recommended',
    })
  }

  // ── 7. Any streaked-but-not-already-addressed nutrients ──────────────────
  for (const alert of alerts) {
    if (!recommended.has(alert.nutrient)) {
      // Generic fallback for nutrients with streaks not specifically handled above
      recommended.set(alert.nutrient, {
        nutrient: alert.nutrient,
        label: alert.label,
        suggestion: `Review dietary sources and consider targeted supplementation of ${alert.label}.`,
        reason: alert.message,
        priority: 'recommended',
      })
    }
  }

  // Sort: essential → recommended → optional
  const ORDER: Record<SupplementRecommendation['priority'], number> = {
    essential: 0,
    recommended: 1,
    optional: 2,
  }
  return Array.from(recommended.values()).sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
}

// ── MPS Leucine Analysis ──────────────────────────────────────────────────────

/**
 * Analyses leucine intake per meal slot against the MPS threshold (2.5–3 g).
 * Groups entries by meal slot and sums leucine per slot.
 */
export function analyseMps(entries: FoodLogEntry[]): MpsAnalysis {
  const byMeal = new Map<string, number>()

  for (const entry of entries) {
    const slot = entry.mealSlot
    byMeal.set(slot, (byMeal.get(slot) ?? 0) + (entry.micros.leucineMg ?? 0))
  }

  const perMeal = Array.from(byMeal.entries()).map(([mealSlot, leucineMg]) => ({
    mealSlot,
    leucineG: round2(leucineMg / 1000),
    aboveThreshold: leucineMg / 1000 >= MPS_LEUCINE_MIN_G,
  }))

  const mealsAboveMpsThreshold = perMeal.filter((m) => m.aboveThreshold).length

  return {
    mealsAboveMpsThreshold,
    totalMeals: byMeal.size,
    mpsThresholdG: MPS_LEUCINE_MIN_G,
    perMeal,
  }
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Generates a full daily micronutrient report.
 *
 * @param date     ISO date string (YYYY-MM-DD) for the report day
 * @param profile  Athlete profile (sex, age, dietType)
 * @param entries  All food log entries for that day (micros scaled by quantity)
 * @param history  Daily status history in chronological order, excluding today
 *                 Used for consecutive-day deficiency streak detection.
 */
export function generateMicroReport(
  date: string,
  profile: AthleteProfile,
  entries: FoodLogEntry[],
  history: DailyStatusEntry[] = []
): MicronutrientReport {
  const targets = buildTargets(profile)
  const totals = aggregateMicros(entries)
  const nutrients = compareToTargets(totals, targets)

  // Build today's status map and append to history for streak detection
  const todayStatuses: Partial<Record<NutrientKey, NutrientStatus>> = {}
  for (const n of nutrients) todayStatuses[n.key] = n.status

  const fullHistory: DailyStatusEntry[] = [...history, { date, statuses: todayStatuses }]

  const keys = nutrients.map((n) => n.key)
  const nutrientLabels = Object.fromEntries(nutrients.map((n) => [n.key, n.label])) as Record<
    NutrientKey,
    string
  >

  const alerts = detectStreaks(fullHistory, keys, nutrientLabels)
  const supplements = generateSupplements(profile, nutrients, alerts)
  const mpsAnalysis = analyseMps(entries)

  return { date, profile, nutrients, alerts, supplements, mpsAnalysis }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
