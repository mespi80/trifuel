'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { athleteProfiles } from '@/db/schema/athlete'
import { raceGoals, trainingPlans, trainingSessions } from '@/db/schema/training'
import { generatePlan, type OnboardingData } from '@/lib/onboarding/schema'

export interface SaveOnboardingResult {
  success: boolean
  error?: string
  planId?: string
}

export async function saveOnboardingAction(data: OnboardingData): Promise<SaveOnboardingResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'unauthenticated' }
  }

  const userId = session.user.id

  try {
    const plan = generatePlan(data)

    // 1. Upsert athlete profile
    await db
      .insert(athleteProfiles)
      .values({
        userId,
        weightKg: data.step2.weightKg,
        heightCm: data.step2.heightCm,
        birthDate: data.step2.birthDate,
        sex: data.step2.sex,
        dietType: data.step3.dietType,
        allergies: data.step3.allergies,
        experienceLevel: data.step4.experienceLevel,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: athleteProfiles.userId,
        set: {
          weightKg: data.step2.weightKg,
          heightCm: data.step2.heightCm,
          birthDate: data.step2.birthDate,
          sex: data.step2.sex,
          dietType: data.step3.dietType,
          allergies: data.step3.allergies,
          experienceLevel: data.step4.experienceLevel,
          updatedAt: new Date(),
        },
      })

    // 2. Insert race goal
    const targetTimes: Record<string, string> = {}
    if (data.step5.targetSwim) targetTimes.swim = data.step5.targetSwim
    if (data.step5.targetBike) targetTimes.bike = data.step5.targetBike
    if (data.step5.targetRun) targetTimes.run = data.step5.targetRun

    const [raceGoal] = await db
      .insert(raceGoals)
      .values({
        userId,
        distance: data.step5.distance,
        raceName: data.step5.raceName,
        raceDate: data.step5.raceDate,
        priority: data.step5.priority,
        targetTimes,
      })
      .returning({ id: raceGoals.id })

    if (!raceGoal) throw new Error('Failed to insert race goal')

    // 3. Insert training plan
    const [trainingPlan] = await db
      .insert(trainingPlans)
      .values({
        userId,
        raceGoalId: raceGoal.id,
        name: plan.name,
        status: 'active',
        weeklyHoursTarget: data.step4.weeklyHours,
        phases: plan.phases,
      })
      .returning({ id: trainingPlans.id })

    if (!trainingPlan) throw new Error('Failed to insert training plan')

    // 4. Insert first week sessions
    if (plan.firstWeekSessions.length > 0) {
      const today = new Date()
      const dayOffsets: Record<string, number> = {
        mon: 0,
        tue: 1,
        wed: 2,
        thu: 3,
        fri: 4,
        sat: 5,
        sun: 6,
      }
      // Align to start of the current week (Monday)
      const dayOfWeek = today.getDay() // 0=Sun, 1=Mon ...
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() + daysToMonday)

      await db.insert(trainingSessions).values(
        plan.firstWeekSessions.map((s) => {
          const sessionDate = new Date(weekStart)
          sessionDate.setDate(weekStart.getDate() + (dayOffsets[s.day] ?? 0))
          return {
            planId: trainingPlan.id,
            date: sessionDate.toISOString().split('T')[0]!,
            discipline: s.discipline,
            durationMinutes: s.durationMinutes,
            intensityZone: s.zone.toLowerCase() as 'z1' | 'z2' | 'z3' | 'z4' | 'z5',
            objective: s.description,
            status: 'planned' as const,
          }
        })
      )
    }

    return { success: true, planId: trainingPlan.id }
  } catch (err) {
    console.error('[saveOnboardingAction]', err)
    return { success: false, error: 'serverError' }
  }
}
