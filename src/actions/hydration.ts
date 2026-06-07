'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { hydrationLogs, athleteProfiles, trainingSessions, trainingPlans } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import {
  calculateDailyHydration,
  calculateElectrolytes,
  calculateSessionHydration,
  type SessionHydrationGuide,
  type ElectrolyteTarget,
} from '@/ai/nutrition/hydration'
import type { SessionInput } from '@/ai/nutrition/macro-calculator'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HydrationLogEntry {
  id: string
  amountMl: number
  type: 'water' | 'electrolyte' | 'other'
  loggedAt: string // ISO
}

export interface HydrationDayData {
  logs: HydrationLogEntry[]
  totalMl: number
  targetMl: number
  baseMl: number
  trainingMl: number
  electrolytes: ElectrolyteTarget
  sessions: SessionHydrationGuide[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!
}

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthenticated')
  return session.user.id
}

// ── getHydrationDay ────────────────────────────────────────────────────────────

export async function getHydrationDay(date?: string): Promise<HydrationDayData> {
  const userId = await requireAuth()
  const targetDate = date ?? todayIso()

  // Athlete weight for base hydration target
  const profile = await db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.userId, userId),
    columns: { weightKg: true },
  })
  const weightKg = profile?.weightKg ?? 70

  // Today's planned/completed sessions (not skipped)
  const rawSessions = await db
    .select({
      discipline: trainingSessions.discipline,
      durationMinutes: trainingSessions.durationMinutes,
      intensityZone: trainingSessions.intensityZone,
    })
    .from(trainingSessions)
    .innerJoin(trainingPlans, eq(trainingSessions.planId, trainingPlans.id))
    .where(and(eq(trainingPlans.userId, userId), eq(trainingSessions.date, targetDate)))

  const sessions: SessionInput[] = rawSessions.map((s) => ({
    discipline: s.discipline,
    durationMinutes: s.durationMinutes,
    intensityZone: s.intensityZone ?? undefined,
  }))

  // Hydration targets
  const daily = calculateDailyHydration(weightKg, sessions)
  const electrolytes = calculateElectrolytes(sessions)

  // Session-by-session guidance
  const sessionGuides: SessionHydrationGuide[] = sessions.map((s) => calculateSessionHydration(s))

  // Today's logs
  const rawLogs = await db
    .select()
    .from(hydrationLogs)
    .where(and(eq(hydrationLogs.userId, userId), eq(hydrationLogs.date, targetDate)))
    .orderBy(desc(hydrationLogs.loggedAt))

  const logs: HydrationLogEntry[] = rawLogs.map((l) => ({
    id: l.id,
    amountMl: l.amountMl,
    type: l.type as 'water' | 'electrolyte' | 'other',
    loggedAt: l.loggedAt.toISOString(),
  }))

  const totalMl = logs.reduce((s, l) => s + l.amountMl, 0)

  return {
    logs,
    totalMl,
    targetMl: daily.totalMl,
    baseMl: daily.baseMl,
    trainingMl: daily.trainingMl,
    electrolytes,
    sessions: sessionGuides,
  }
}

// ── addHydrationLog ────────────────────────────────────────────────────────────

export async function addHydrationLog(
  amountMl: number,
  type: 'water' | 'electrolyte' | 'other' = 'water',
  date?: string
): Promise<HydrationLogEntry> {
  const userId = await requireAuth()
  const targetDate = date ?? todayIso()

  const [row] = await db
    .insert(hydrationLogs)
    .values({
      userId,
      date: targetDate,
      amountMl,
      type,
    })
    .returning()

  revalidatePath('/[lang]/dashboard/hydration', 'page')

  return {
    id: row!.id,
    amountMl: row!.amountMl,
    type: row!.type as 'water' | 'electrolyte' | 'other',
    loggedAt: row!.loggedAt.toISOString(),
  }
}

// ── removeHydrationLog ─────────────────────────────────────────────────────────

export async function removeHydrationLog(id: string): Promise<void> {
  const userId = await requireAuth()

  await db.delete(hydrationLogs).where(
    and(
      eq(hydrationLogs.id, id),
      eq(hydrationLogs.userId, userId) // security: own rows only
    )
  )

  revalidatePath('/[lang]/dashboard/hydration', 'page')
}
