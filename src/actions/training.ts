'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { trainingSessions, trainingPlans } from '@/db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type CalendarSession = {
  id: string
  date: string
  discipline: 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'recovery'
  durationMinutes: number
  intensityZone: 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | null
  objective: string | null
  status: 'planned' | 'completed' | 'missed' | 'skipped'
  rpe: number | null
  intervals: Array<{
    reps: number
    distance?: number
    durationSeconds?: number
    restSeconds: number
    targetPace?: string
    targetPower?: number
    targetHr?: number
  }>
  actualData: {
    durationSeconds?: number
    distanceMeters?: number
    avgHr?: number
    maxHr?: number
    avgPowerWatts?: number
    normalizedPowerWatts?: number
    avgPaceSecPer100m?: number
    avgPaceSecPerKm?: number
    tss?: number
    elevationGainM?: number
    calories?: number
  } | null
  notes: string | null
  completedAt: Date | null
}

export async function getSessionsForRange(
  startDate: string,
  endDate: string
): Promise<CalendarSession[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const plans = await db
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.userId, session.user.id), eq(trainingPlans.status, 'active')))
    .limit(1)

  if (plans.length === 0) return []

  const planId = plans[0]!.id

  const rows = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.planId, planId),
        gte(trainingSessions.date, startDate),
        lte(trainingSessions.date, endDate)
      )
    )
    .orderBy(trainingSessions.date)

  return rows.map((r) => ({
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
  }))
}

export async function getSessionById(sessionId: string): Promise<CalendarSession | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const rows = await db
    .select({
      session: trainingSessions,
      plan: { userId: trainingPlans.userId },
    })
    .from(trainingSessions)
    .innerJoin(trainingPlans, eq(trainingSessions.planId, trainingPlans.id))
    .where(eq(trainingSessions.id, sessionId))
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]!
  if (row.plan.userId !== session.user.id) return null

  const r = row.session
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

export async function updateSessionRpe(sessionId: string, rpe: number): Promise<{ ok: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false }

  // Verify ownership
  const existing = await getSessionById(sessionId)
  if (!existing) return { ok: false }

  await db
    .update(trainingSessions)
    .set({ rpe, status: 'completed', completedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId))

  revalidatePath('/[lang]/dashboard/training', 'page')
  revalidatePath(`/[lang]/dashboard/training/${sessionId}`, 'page')
  return { ok: true }
}

export async function updateSessionNotes(
  sessionId: string,
  notes: string
): Promise<{ ok: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false }

  const existing = await getSessionById(sessionId)
  if (!existing) return { ok: false }

  await db.update(trainingSessions).set({ notes }).where(eq(trainingSessions.id, sessionId))

  revalidatePath(`/[lang]/dashboard/training/${sessionId}`, 'page')
  return { ok: true }
}

export async function rescheduleSession(
  sessionId: string,
  newDate: string
): Promise<{ ok: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false }

  const existing = await getSessionById(sessionId)
  if (!existing) return { ok: false }

  await db.update(trainingSessions).set({ date: newDate }).where(eq(trainingSessions.id, sessionId))

  revalidatePath('/[lang]/dashboard/training', 'page')
  return { ok: true }
}

export async function getUserSubscriptionTier(): Promise<'free' | 'premium'> {
  const { getSubscriptionTier } = await import('@/actions/subscription')
  return getSubscriptionTier()
}
