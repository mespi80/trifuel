'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import {
  trainingSessions,
  trainingPlans,
  foodLogs,
  foodItems,
  nutritionTargets,
  hydrationLogs,
  athleteProfiles,
  users,
} from '@/db/schema'
import { and, eq, gte, lte, sum } from 'drizzle-orm'
import { calculateDailyHydration } from '@/ai/nutrition/hydration'
import type { CalendarSession } from './training'
import type { SessionInput } from '@/ai/nutrition/macro-calculator'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashboardNutrition {
  choG: number
  proteinG: number
  fatG: number
  calories: number
  targetChoG: number | null
  targetProteinG: number | null
  targetFatG: number | null
  targetCalories: number | null
}

export interface DashboardHydration {
  totalMl: number
  targetMl: number
}

export interface RecoveryPrompt {
  sessionId: string
  discipline: CalendarSession['discipline']
}

export interface DashboardData {
  userName: string | null
  today: string // ISO date yyyy-mm-dd
  todaySessions: CalendarSession[]
  weekSessions: CalendarSession[]
  weekStart: string // ISO date of Monday
  nutrition: DashboardNutrition
  hydration: DashboardHydration
  recoveryPrompt: RecoveryPrompt | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]!
}

/** Returns ISO date of the Monday of the week containing `d`. */
function weekMonday(d: Date): string {
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day // days to subtract to reach Monday
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return isoDate(mon)
}

/** Returns ISO date of the Sunday of the week containing `d`. */
function weekSunday(d: Date): string {
  const day = d.getDay()
  const diff = day === 0 ? 0 : 7 - day
  const sun = new Date(d)
  sun.setDate(d.getDate() + diff)
  return isoDate(sun)
}

function mapSession(r: typeof trainingSessions.$inferSelect): CalendarSession {
  return {
    id: r.id,
    date: r.date,
    discipline: r.discipline as CalendarSession['discipline'],
    durationMinutes: r.durationMinutes,
    intensityZone: r.intensityZone as CalendarSession['intensityZone'],
    objective: r.objective,
    status: r.status as CalendarSession['status'],
    rpe: r.rpe,
    intervals: (r.intervals ?? []) as CalendarSession['intervals'],
    actualData: r.actualData as CalendarSession['actualData'],
    notes: r.notes,
    completedAt: r.completedAt,
  }
}

// ── getDashboardData ──────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData | null> {
  const authSession = await auth()
  if (!authSession?.user?.id) return null
  const userId = authSession.user.id

  const now = new Date()
  const today = isoDate(now)
  const monday = weekMonday(now)
  const sunday = weekSunday(now)

  // Run all queries in parallel
  const [userRow, activePlan, nutritionRows, targetRow, hydrationSum, athleteProfile] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true },
      }),
      db.query.trainingPlans.findFirst({
        where: and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, 'active')),
        columns: { id: true },
      }),
      db
        .select({ log: foodLogs, item: foodItems })
        .from(foodLogs)
        .innerJoin(foodItems, eq(foodLogs.foodItemId, foodItems.id))
        .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, today))),
      db.query.nutritionTargets.findFirst({
        where: and(eq(nutritionTargets.userId, userId), eq(nutritionTargets.date, today)),
      }),
      db
        .select({ total: sum(hydrationLogs.amountMl) })
        .from(hydrationLogs)
        .where(and(eq(hydrationLogs.userId, userId), eq(hydrationLogs.date, today))),
      db.query.athleteProfiles.findFirst({
        where: eq(athleteProfiles.userId, userId),
        columns: { weightKg: true },
      }),
    ])

  // Sessions for today and the full week
  let todaySessions: CalendarSession[] = []
  let weekSessions: CalendarSession[] = []

  if (activePlan) {
    const allWeekSessions = await db
      .select()
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.planId, activePlan.id),
          gte(trainingSessions.date, monday),
          lte(trainingSessions.date, sunday)
        )
      )
      .orderBy(trainingSessions.date)

    weekSessions = allWeekSessions.map(mapSession)
    todaySessions = weekSessions.filter((s) => s.date === today)
  }

  // Nutrition totals
  const totals = nutritionRows.reduce(
    (acc, { log, item }) => {
      const q = log.quantity
      const m = item.macros as {
        choG: number
        proteinG: number
        fatG: number
        calories: number
      }
      return {
        choG: Math.round((acc.choG + m.choG * q) * 10) / 10,
        proteinG: Math.round((acc.proteinG + m.proteinG * q) * 10) / 10,
        fatG: Math.round((acc.fatG + m.fatG * q) * 10) / 10,
        calories: acc.calories + Math.round(m.calories * q),
      }
    },
    { choG: 0, proteinG: 0, fatG: 0, calories: 0 }
  )

  // Hydration target using calculator
  const weightKg = athleteProfile?.weightKg ?? 70
  const sessionInputs: SessionInput[] = todaySessions.map((s) => ({
    discipline: s.discipline,
    durationMinutes: s.durationMinutes,
    intensityZone: s.intensityZone ?? undefined,
  }))
  const { totalMl: hydrationTarget } = calculateDailyHydration(weightKg, sessionInputs)
  const totalHydrationMl = Number(hydrationSum[0]?.total ?? 0)

  // Recovery prompt: completed session within last 60 min
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recoverySession = todaySessions.find(
    (s) => s.status === 'completed' && s.completedAt !== null && s.completedAt >= sixtyMinAgo
  )
  const recoveryPrompt: RecoveryPrompt | null = recoverySession
    ? { sessionId: recoverySession.id, discipline: recoverySession.discipline }
    : null

  return {
    userName: userRow?.name ?? null,
    today,
    todaySessions,
    weekSessions,
    weekStart: monday,
    nutrition: {
      choG: totals.choG,
      proteinG: totals.proteinG,
      fatG: totals.fatG,
      calories: totals.calories,
      targetChoG: targetRow?.choG ?? null,
      targetProteinG: targetRow?.proteinG ?? null,
      targetFatG: targetRow?.fatG ?? null,
      targetCalories: targetRow?.calories ?? null,
    },
    hydration: {
      totalMl: totalHydrationMl,
      targetMl: hydrationTarget,
    },
    recoveryPrompt,
  }
}
