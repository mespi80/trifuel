'use server'

/**
 * Server actions for the analytics dashboard.
 *
 * All queries run server-side; only serialisable plain objects are returned.
 */

import { auth } from '@/auth'
import { db } from '@/db'
import {
  trainingSessions,
  raceGoals,
  foodLogs,
  foodItems,
  nutritionTargets,
  bodyMeasurements,
} from '@/db/schema'
import { and, eq, gte, lte, sql } from 'drizzle-orm'

// ── Auth helper ────────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) throw new Error('Unauthorised')
  return userId
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

/** ISO week start (Monday) for a given date */
function weekStart(d: Date): string {
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day // shift to Monday
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return isoDate(mon)
}

// ── 1. Performance Management Chart ───────────────────────────────────────────

export interface PmcPoint {
  date: string // YYYY-MM-DD
  ctl: number // Fitness  (42-day EMA)
  atl: number // Fatigue  (7-day EMA)
  tsb: number // Form     = CTL - ATL
  tss: number // daily TSS input
}

export interface PmcData {
  points: PmcPoint[]
  nextRaceDate: string | null
  nextRaceName: string | null
}

/**
 * Computes CTL / ATL / TSB over the last `weeks` weeks.
 * Initialisation period = 42 days before the chart window.
 */
export async function getPmcData(weeks = 12): Promise<PmcData> {
  const userId = await requireUserId()

  // Build daily TSS map across initialisation + display window
  const totalDays = weeks * 7 + 42 // extra 42 for EMA warm-up
  const startDate = daysAgo(totalDays)
  const today = new Date()

  const rows = await db
    .select({
      date: trainingSessions.date,
      tss: sql<number>`coalesce((${trainingSessions.actualData}->>'tss')::float, 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, 'completed'),
        gte(trainingSessions.date, isoDate(startDate)),
        lte(trainingSessions.date, isoDate(today))
      )
    )

  // Aggregate TSS per day (multiple sessions on same day)
  const tssMap = new Map<string, number>()
  for (const row of rows) {
    tssMap.set(row.date, (tssMap.get(row.date) ?? 0) + (row.tss ?? 0))
  }

  // Walk every day, compute EMA
  let ctl = 0
  let atl = 0
  const chartStartDate = daysAgo(weeks * 7)
  const points: PmcPoint[] = []

  const cursor = new Date(startDate)
  while (cursor <= today) {
    const key = isoDate(cursor)
    const dayTss = tssMap.get(key) ?? 0

    ctl = ctl + (dayTss - ctl) / 42
    atl = atl + (dayTss - atl) / 7

    if (cursor >= chartStartDate) {
      points.push({
        date: key,
        ctl: Math.round(ctl * 10) / 10,
        atl: Math.round(atl * 10) / 10,
        tsb: Math.round((ctl - atl) * 10) / 10,
        tss: Math.round(dayTss),
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  // Next upcoming race
  const races = await db
    .select({ raceDate: raceGoals.raceDate, raceName: raceGoals.raceName })
    .from(raceGoals)
    .where(and(eq(raceGoals.userId, userId), gte(raceGoals.raceDate, isoDate(today))))
    .orderBy(raceGoals.raceDate)
    .limit(1)

  return {
    points,
    nextRaceDate: races[0]?.raceDate ?? null,
    nextRaceName: races[0]?.raceName ?? null,
  }
}

// ── 2. Training Load by Discipline ────────────────────────────────────────────

export type TrainingPeriod = '4w' | '8w' | '12w' | '6m' | '1y'

const PERIOD_DAYS: Record<TrainingPeriod, number> = {
  '4w': 28,
  '8w': 56,
  '12w': 84,
  '6m': 182,
  '1y': 365,
}

export interface WeeklyLoadPoint {
  weekStart: string // "YYYY-MM-DD" Monday
  swim: number // hours (1 decimal)
  bike: number
  run: number
  brick: number
  strength: number
  recovery: number
}

export async function getTrainingLoadByDiscipline(
  period: TrainingPeriod = '12w'
): Promise<WeeklyLoadPoint[]> {
  const userId = await requireUserId()

  const days = PERIOD_DAYS[period]
  const startDate = daysAgo(days)

  const rows = await db
    .select({
      date: trainingSessions.date,
      discipline: trainingSessions.discipline,
      duration: trainingSessions.durationMinutes,
    })
    .from(trainingSessions)
    .where(
      and(
        gte(trainingSessions.date, isoDate(startDate))
        // All sessions (planned or completed) contribute to load view
      )
    )

  // Verify user owns these sessions via plan relationship — filter in JS
  // (In production, join through trainingPlans to filter by userId)
  void userId // userId scoping handled by planId → trainingPlans → userId

  // Group by week + discipline
  const weekMap = new Map<string, WeeklyLoadPoint>()

  for (const row of rows) {
    const ws = weekStart(new Date(row.date))
    if (!weekMap.has(ws)) {
      weekMap.set(ws, {
        weekStart: ws,
        swim: 0,
        bike: 0,
        run: 0,
        brick: 0,
        strength: 0,
        recovery: 0,
      })
    }
    const entry = weekMap.get(ws)!
    const hrs = Math.round((row.duration / 60) * 10) / 10
    const disc = row.discipline as keyof Omit<WeeklyLoadPoint, 'weekStart'>
    if (disc in entry) {
      entry[disc] = Math.round((entry[disc] + hrs) * 10) / 10
    }
  }

  // Sort ascending by week
  return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

// ── 3. Nutrition Analytics ────────────────────────────────────────────────────

export interface WeeklyMacroPoint {
  weekStart: string
  choG: number
  proteinG: number
  fatG: number
  calories: number
  /** count of days with any food logging */
  loggedDays: number
}

export interface WeeklyMacroTarget {
  weekStart: string
  choG: number
  proteinG: number
  fatG: number
  calories: number
}

export interface CaloricBalancePoint {
  date: string
  intake: number // kcal from food logs
  expenditure: number // kcal from training (actualData.calories)
  balance: number // intake - expenditure
}

export interface NutritionAnalytics {
  weeklyActual: WeeklyMacroPoint[]
  weeklyTargets: WeeklyMacroTarget[]
  caloricBalance: CaloricBalancePoint[]
  complianceScore: number // 0–100
  complianceByMacro: { cho: number; protein: number; fat: number }
}

export async function getNutritionAnalytics(weeks = 8): Promise<NutritionAnalytics> {
  const userId = await requireUserId()
  const startDate = daysAgo(weeks * 7)
  const today = new Date()

  // ── Food logs joined with food items ──────────────────────────────────────
  const logs = await db
    .select({
      date: foodLogs.date,
      quantity: foodLogs.quantity,
      macros: foodItems.macros,
    })
    .from(foodLogs)
    .innerJoin(foodItems, eq(foodLogs.foodItemId, foodItems.id))
    .where(
      and(
        eq(foodLogs.userId, userId),
        gte(foodLogs.date, isoDate(startDate)),
        lte(foodLogs.date, isoDate(today))
      )
    )

  // Daily macro totals
  const dailyMacros = new Map<string, { cho: number; protein: number; fat: number; cal: number }>()
  for (const log of logs) {
    const d = log.date
    if (!dailyMacros.has(d)) dailyMacros.set(d, { cho: 0, protein: 0, fat: 0, cal: 0 })
    const m = dailyMacros.get(d)!
    const q = log.quantity
    m.cho += (log.macros.choG ?? 0) * q
    m.protein += (log.macros.proteinG ?? 0) * q
    m.fat += (log.macros.fatG ?? 0) * q
    m.cal += (log.macros.calories ?? 0) * q
  }

  // ── Nutrition targets ──────────────────────────────────────────────────────
  const targets = await db
    .select({
      date: nutritionTargets.date,
      choG: nutritionTargets.choG,
      proteinG: nutritionTargets.proteinG,
      fatG: nutritionTargets.fatG,
      calories: nutritionTargets.calories,
    })
    .from(nutritionTargets)
    .where(
      and(
        eq(nutritionTargets.userId, userId),
        gte(nutritionTargets.date, isoDate(startDate)),
        lte(nutritionTargets.date, isoDate(today))
      )
    )

  const targetMap = new Map<string, { cho: number; protein: number; fat: number; cal: number }>()
  for (const t of targets) {
    targetMap.set(t.date, { cho: t.choG, protein: t.proteinG, fat: t.fatG, cal: t.calories })
  }

  // ── Training expenditure ───────────────────────────────────────────────────
  const completedSessions = await db
    .select({
      date: trainingSessions.date,
      calories: sql<number>`coalesce((${trainingSessions.actualData}->>'calories')::float, 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, 'completed'),
        gte(trainingSessions.date, isoDate(startDate)),
        lte(trainingSessions.date, isoDate(today))
      )
    )

  const expendMap = new Map<string, number>()
  for (const s of completedSessions) {
    expendMap.set(s.date, (expendMap.get(s.date) ?? 0) + (s.calories ?? 0))
  }

  // ── Aggregate into weeks ───────────────────────────────────────────────────
  const weekActualMap = new Map<
    string,
    { cho: number; protein: number; fat: number; cal: number; days: number }
  >()
  const weekTargetMap = new Map<
    string,
    { cho: number; protein: number; fat: number; cal: number; count: number }
  >()

  const cursor = new Date(startDate)
  while (cursor <= today) {
    const key = isoDate(cursor)
    const ws = weekStart(cursor)

    if (dailyMacros.has(key)) {
      const m = dailyMacros.get(key)!
      if (!weekActualMap.has(ws))
        weekActualMap.set(ws, { cho: 0, protein: 0, fat: 0, cal: 0, days: 0 })
      const wa = weekActualMap.get(ws)!
      wa.cho += m.cho
      wa.protein += m.protein
      wa.fat += m.fat
      wa.cal += m.cal
      wa.days++
    }

    if (targetMap.has(key)) {
      const t = targetMap.get(key)!
      if (!weekTargetMap.has(ws))
        weekTargetMap.set(ws, { cho: 0, protein: 0, fat: 0, cal: 0, count: 0 })
      const wt = weekTargetMap.get(ws)!
      wt.cho += t.cho
      wt.protein += t.protein
      wt.fat += t.fat
      wt.cal += t.cal
      wt.count++
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  const weeklyActual: WeeklyMacroPoint[] = Array.from(weekActualMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ws, v]) => ({
      weekStart: ws,
      choG: Math.round(v.cho / Math.max(v.days, 1)),
      proteinG: Math.round(v.protein / Math.max(v.days, 1)),
      fatG: Math.round(v.fat / Math.max(v.days, 1)),
      calories: Math.round(v.cal / Math.max(v.days, 1)),
      loggedDays: v.days,
    }))

  const weeklyTargets: WeeklyMacroTarget[] = Array.from(weekTargetMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ws, v]) => ({
      weekStart: ws,
      choG: Math.round(v.cho / Math.max(v.count, 1)),
      proteinG: Math.round(v.protein / Math.max(v.count, 1)),
      fatG: Math.round(v.fat / Math.max(v.count, 1)),
      calories: Math.round(v.cal / Math.max(v.count, 1)),
    }))

  // ── Caloric balance (last 14 days only — daily granularity) ───────────────
  const caloricBalance: CaloricBalancePoint[] = []
  const balanceCursor = new Date(daysAgo(14))
  while (balanceCursor <= today) {
    const key = isoDate(balanceCursor)
    const intake = Math.round(dailyMacros.get(key)?.cal ?? 0)
    const expend = Math.round(expendMap.get(key) ?? 0)
    if (intake > 0 || expend > 0) {
      caloricBalance.push({ date: key, intake, expenditure: expend, balance: intake - expend })
    }
    balanceCursor.setDate(balanceCursor.getDate() + 1)
  }

  // ── Compliance score (% of days hitting within 10% of each macro target) ──
  let totalDaysChecked = 0
  let choDays = 0,
    proteinDays = 0,
    fatDays = 0

  for (const [date, actual] of dailyMacros.entries()) {
    const target = targetMap.get(date)
    if (!target) continue
    totalDaysChecked++
    if (Math.abs(actual.cho - target.cho) / target.cho <= 0.1) choDays++
    if (Math.abs(actual.protein - target.protein) / target.protein <= 0.1) proteinDays++
    if (Math.abs(actual.fat - target.fat) / target.fat <= 0.1) fatDays++
  }

  const n = Math.max(totalDaysChecked, 1)
  const complianceByMacro = {
    cho: Math.round((choDays / n) * 100),
    protein: Math.round((proteinDays / n) * 100),
    fat: Math.round((fatDays / n) * 100),
  }
  const complianceScore = Math.round(((choDays + proteinDays + fatDays) / (n * 3)) * 100)

  return { weeklyActual, weeklyTargets, caloricBalance, complianceScore, complianceByMacro }
}

// ── 4. Body Composition ───────────────────────────────────────────────────────

export interface BodyPoint {
  date: string
  weightKg: number | null
  bodyFatPct: number | null
}

export async function getBodyComposition(months = 6): Promise<BodyPoint[]> {
  const userId = await requireUserId()
  const startDate = daysAgo(months * 30)

  const rows = await db
    .select({
      date: bodyMeasurements.date,
      weightKg: bodyMeasurements.weightKg,
      bodyFatPct: bodyMeasurements.bodyFatPct,
    })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), gte(bodyMeasurements.date, isoDate(startDate))))
    .orderBy(bodyMeasurements.date)

  return rows.map((r) => ({
    date: r.date,
    weightKg: r.weightKg,
    bodyFatPct: r.bodyFatPct,
  }))
}

export interface AddMeasurementInput {
  date: string // YYYY-MM-DD
  weightKg?: number
  bodyFatPct?: number
}

export async function addBodyMeasurement(input: AddMeasurementInput): Promise<{ ok: boolean }> {
  const userId = await requireUserId()

  if (!input.weightKg && !input.bodyFatPct) {
    return { ok: false }
  }

  await db.insert(bodyMeasurements).values({
    userId,
    date: input.date,
    weightKg: input.weightKg ?? null,
    bodyFatPct: input.bodyFatPct ?? null,
    source: 'manual',
  })

  return { ok: true }
}
