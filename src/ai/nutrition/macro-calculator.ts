/**
 * Nutrition macro calculator for triathlon athletes.
 *
 * Periodizes CHO, protein, fat, hydration, and per-meal protein targets
 * based on training day type (rest / light / moderate / hard).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DietType = 'vegan' | 'vegetarian' | 'omnivore'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type TrainingDayType = 'rest' | 'light' | 'moderate' | 'hard'
export type SessionDiscipline = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'recovery'
export type IntensityZone = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6'

export interface SessionInput {
  discipline: SessionDiscipline
  durationMinutes: number
  intensityZone?: IntensityZone | null
}

export interface NutritionAthleteProfile {
  weightKg: number
  age: number
  dietType: DietType
  experienceLevel: ExperienceLevel
}

export interface MealProteinTarget {
  meal: number // 1-indexed
  proteinG: number
}

export interface DailyMacroTargets {
  dayType: TrainingDayType
  carbsG: number
  proteinG: number
  fatG: number
  totalKcal: number
  hydrationMl: number
  meals: MealProteinTarget[]
  carbsRange: { minGPerKg: number; maxGPerKg: number }
  proteinRange: { minGPerKg: number; maxGPerKg: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** CHO (g/kg) range per training day type */
export const CHO_RANGES: Record<TrainingDayType, { min: number; max: number }> = {
  rest: { min: 3, max: 4 },
  light: { min: 5, max: 6 },
  moderate: { min: 6, max: 8 },
  hard: { min: 8, max: 12 },
}

/** Protein (g/kg) range by age group */
export const PROTEIN_RANGES = {
  under40: { min: 1.6, max: 2.0 },
  over40: { min: 1.8, max: 2.2 },
} as const

export const FAT_MIN_G_PER_KG = 0.8
/** Resting metabolic base for athletes (kcal/kg/day) */
export const BMR_KCAL_PER_KG = 28
export const HYDRATION_BASE_ML_PER_KG = 35
export const HYDRATION_MIN_ML_PER_HOUR = 500
export const HYDRATION_MAX_ML_PER_HOUR = 750
export const MIN_MEAL_PROTEIN_G = 20
export const MEALS_HIGH_PROTEIN_THRESHOLD_G = 80 // 4 meals above this

/**
 * Zone load multiplier for effective training-load scoring.
 * Used to weight CHO needs by intensity, not just duration.
 */
const ZONE_LOAD_MULTIPLIER: Record<IntensityZone, number> = {
  z1: 0.5,
  z2: 0.75,
  z3: 1.0,
  z4: 1.3,
  z5: 1.6,
  z6: 2.0,
}

/** Base MET values by discipline */
const DISCIPLINE_MET: Record<SessionDiscipline, number> = {
  swim: 7.0,
  bike: 8.0,
  run: 9.0,
  brick: 9.0,
  strength: 5.0,
  recovery: 2.5,
}

/** Zone scale factor for MET adjustment */
const ZONE_MET_FACTOR: Record<IntensityZone, number> = {
  z1: 0.7,
  z2: 0.85,
  z3: 1.0,
  z4: 1.2,
  z5: 1.4,
  z6: 1.6,
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Returns sessions that count toward training load.
 * Pure recovery sessions are treated as rest.
 */
function activeSessions(sessions: SessionInput[]): SessionInput[] {
  return sessions.filter((s) => s.discipline !== 'recovery')
}

/**
 * Effective training-load minutes — duration weighted by zone intensity.
 * A 60-min Z5 session counts more than a 60-min Z1 session.
 */
function effectiveMinutes(sessions: SessionInput[]): number {
  return activeSessions(sessions).reduce((sum, s) => {
    const mult = s.intensityZone != null ? ZONE_LOAD_MULTIPLIER[s.intensityZone] : 1.0
    return sum + s.durationMinutes * mult
  }, 0)
}

// ── Day Classification ────────────────────────────────────────────────────────

/**
 * Classifies the training day type based on session inputs.
 *
 * - hard:     any Z4/Z5/Z6 session, any brick, single session ≥ 90 min, or total ≥ 120 min
 * - moderate: any Z2/Z3 session, or total active time ≥ 60 min
 * - light:    easy sessions under 60 min total
 * - rest:     no active sessions (recovery-only or empty)
 */
export function classifyTrainingDay(sessions: SessionInput[]): TrainingDayType {
  const active = activeSessions(sessions)
  if (active.length === 0) return 'rest'

  const hasHighIntensity = active.some(
    (s) => s.intensityZone != null && ['z4', 'z5', 'z6'].includes(s.intensityZone)
  )
  const hasBrick = active.some((s) => s.discipline === 'brick')
  const hasSingleLongSession = active.some((s) => s.durationMinutes >= 90)
  const totalMinutes = active.reduce((sum, s) => sum + s.durationMinutes, 0)

  if (hasHighIntensity || hasBrick || hasSingleLongSession || totalMinutes >= 120) {
    return 'hard'
  }

  const hasMediumIntensity = active.some(
    (s) => s.intensityZone != null && ['z2', 'z3'].includes(s.intensityZone)
  )
  if (hasMediumIntensity || totalMinutes >= 60) return 'moderate'

  return 'light'
}

// ── CHO Calculation ───────────────────────────────────────────────────────────

/**
 * Calculates CHO target in grams.
 *
 * Scales continuously within the periodization range based on effective load:
 * - rest:     3.5 g/kg (fixed midpoint, range 3–4)
 * - light:    5.5 g/kg (fixed midpoint, range 5–6)
 * - moderate: 6–8 g/kg — 6 at 60 eff-min, 8 at 120 eff-min
 * - hard:     8–12 g/kg — 8 at 90 eff-min, 12 at 270 eff-min
 */
export function calculateCho(
  weightKg: number,
  dayType: TrainingDayType,
  sessions: SessionInput[]
): { g: number; range: { minGPerKg: number; maxGPerKg: number } } {
  const range = CHO_RANGES[dayType]
  const effMin = effectiveMinutes(sessions)

  let gPerKg: number
  switch (dayType) {
    case 'rest':
      gPerKg = 3.5
      break
    case 'light':
      gPerKg = 5.5
      break
    case 'moderate': {
      // 6 g/kg at 60 eff-min, 8 g/kg at 120 eff-min, clamped at both ends
      const scale = Math.min(1, Math.max(0, (effMin - 60) / 60))
      gPerKg = 6 + scale * 2
      break
    }
    case 'hard': {
      // 8 g/kg at 90 eff-min, 12 g/kg at 270 eff-min, clamped at both ends
      const scale = Math.min(1, Math.max(0, (effMin - 90) / 180))
      gPerKg = 8 + scale * 4
      break
    }
  }

  return {
    g: round1(gPerKg * weightKg),
    range: { minGPerKg: range.min, maxGPerKg: range.max },
  }
}

// ── Protein Calculation ───────────────────────────────────────────────────────

/**
 * Calculates protein target in grams.
 *
 * Protein needs are higher for masters athletes (≥40) and scale with training load:
 * - rest/light → minimum of range
 * - moderate   → midpoint
 * - hard       → maximum of range
 */
export function calculateProtein(
  weightKg: number,
  age: number,
  dayType: TrainingDayType
): { g: number; range: { minGPerKg: number; maxGPerKg: number } } {
  const ageGroup = age >= 40 ? 'over40' : 'under40'
  const { min, max } = PROTEIN_RANGES[ageGroup]

  const gPerKg =
    dayType === 'rest' || dayType === 'light' ? min : dayType === 'moderate' ? (min + max) / 2 : max

  return {
    g: round1(gPerKg * weightKg),
    range: { minGPerKg: min, maxGPerKg: max },
  }
}

// ── Hydration Calculation ─────────────────────────────────────────────────────

/**
 * Calculates daily hydration target in ml.
 *
 * Base: 35 ml/kg
 * Training: 500–750 ml per hour, scaled with zone intensity.
 * Recovery sessions do not add training hydration.
 */
export function calculateHydration(weightKg: number, sessions: SessionInput[]): number {
  const baseMl = HYDRATION_BASE_ML_PER_KG * weightKg

  const trainingMl = activeSessions(sessions).reduce((sum, s) => {
    const hours = s.durationMinutes / 60
    const loadMult = s.intensityZone != null ? ZONE_LOAD_MULTIPLIER[s.intensityZone] : 1.0
    // Map load multiplier [0.5, 2.0] → [500, 750] ml/hr linearly
    const mlPerHour =
      HYDRATION_MIN_ML_PER_HOUR +
      Math.min(1, (loadMult - 0.5) / 1.5) * (HYDRATION_MAX_ML_PER_HOUR - HYDRATION_MIN_ML_PER_HOUR)
    return sum + hours * mlPerHour
  }, 0)

  return Math.round(baseMl + trainingMl)
}

// ── Meal Distribution ─────────────────────────────────────────────────────────

/**
 * Distributes daily protein across 3 or 4 meals.
 *
 * Uses 4 meals when protein ≥ 80 g (supports muscle protein synthesis every ~4 hrs).
 * Each meal is floored at MIN_MEAL_PROTEIN_G = 20 g.
 */
export function calculateMeals(proteinG: number): MealProteinTarget[] {
  const numMeals = proteinG >= MEALS_HIGH_PROTEIN_THRESHOLD_G ? 4 : 3
  const perMeal = Math.max(MIN_MEAL_PROTEIN_G, round1(proteinG / numMeals))

  return Array.from({ length: numMeals }, (_, i) => ({
    meal: i + 1,
    proteinG: perMeal,
  }))
}

// ── TDEE Estimation ───────────────────────────────────────────────────────────

/**
 * Estimates Total Daily Energy Expenditure (kcal).
 * BMR: 28 kcal/kg (active athlete baseline).
 * Exercise: MET × zone-factor × weight × hours per session.
 */
function estimateTdee(weightKg: number, sessions: SessionInput[]): number {
  const bmr = BMR_KCAL_PER_KG * weightKg

  const exerciseKcal = sessions.reduce((sum, s) => {
    const hours = s.durationMinutes / 60
    const met = DISCIPLINE_MET[s.discipline]
    const zoneFactor = s.intensityZone != null ? ZONE_MET_FACTOR[s.intensityZone] : 1.0
    return sum + met * zoneFactor * weightKg * hours
  }, 0)

  return bmr + exerciseKcal
}

// ── Main Calculator ───────────────────────────────────────────────────────────

/**
 * Calculates all daily macro targets for an athlete.
 *
 * Fat is the remainder of TDEE after CHO and protein, clamped to a
 * minimum of 0.8 g/kg to ensure hormone and micronutrient adequacy.
 */
export function calculateDailyMacros(
  profile: NutritionAthleteProfile,
  sessions: SessionInput[]
): DailyMacroTargets {
  const { weightKg, age } = profile

  const dayType = classifyTrainingDay(sessions)

  const { g: carbsG, range: carbsRange } = calculateCho(weightKg, dayType, sessions)
  const { g: proteinG, range: proteinRange } = calculateProtein(weightKg, age, dayType)
  const hydrationMl = calculateHydration(weightKg, sessions)

  const tdee = estimateTdee(weightKg, sessions)
  const carbsKcal = carbsG * 4
  const proteinKcal = proteinG * 4
  const remainingKcal = tdee - carbsKcal - proteinKcal

  const minFatG = FAT_MIN_G_PER_KG * weightKg
  const fatG = round1(Math.max(minFatG, remainingKcal / 9))

  const totalKcal = Math.round(carbsKcal + proteinKcal + fatG * 9)
  const meals = calculateMeals(proteinG)

  return {
    dayType,
    carbsG,
    proteinG,
    fatG,
    totalKcal,
    hydrationMl,
    meals,
    carbsRange,
    proteinRange,
  }
}
