import { z } from 'zod'

// ── Step 2: Athlete Profile ───────────────────────────────────────────────────
export const step2Schema = z.object({
  weightKg: z.coerce
    .number({ message: 'weightRequired' })
    .min(30, 'weightRange')
    .max(250, 'weightRange'),
  heightCm: z.coerce
    .number({ message: 'heightRequired' })
    .min(100, 'heightRange')
    .max(250, 'heightRange'),
  birthDate: z
    .string({ message: 'dobRequired' })
    .min(1, 'dobRequired')
    .refine((d) => new Date(d) < new Date(), 'dobPast'),
  sex: z.enum(['male', 'female', 'other'], { message: 'sexRequired' }),
})
export type Step2Data = z.infer<typeof step2Schema>

// ── Step 3: Diet Preferences ─────────────────────────────────────────────────
export const step3Schema = z.object({
  dietType: z.enum(['vegan', 'vegetarian', 'omnivore'], { message: 'dietRequired' }),
  allergies: z.array(z.string()).default([]),
})
export type Step3Data = z.infer<typeof step3Schema>

// ── Step 4: Training Background ───────────────────────────────────────────────
export const step4Schema = z.object({
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'elite'], {
    message: 'experienceRequired',
  }),
  weeklyHours: z.coerce
    .number({ message: 'weeklyHoursRequired' })
    .min(1, 'weeklyHoursRequired')
    .max(40),
  swimPace: z.string().optional(), // e.g. "1:45"
  ftp: z.coerce.number().min(50).max(600).optional(),
  runPace: z.string().optional(), // e.g. "4:30"
})
export type Step4Data = z.infer<typeof step4Schema>

// ── Step 5: Race Goal ─────────────────────────────────────────────────────────
export const step5Schema = z.object({
  distance: z.enum(['sprint', 'olympic', 'half_ironman', 'ironman'], {
    message: 'distanceRequired',
  }),
  raceName: z.string({ message: 'raceNameRequired' }).min(1, 'raceNameRequired').max(100),
  raceDate: z
    .string({ message: 'raceDateRequired' })
    .min(1, 'raceDateRequired')
    .refine((d) => new Date(d) > new Date(), 'raceDateFuture'),
  priority: z.enum(['A', 'B', 'C'], { message: 'priorityRequired' }),
  targetSwim: z.string().optional(),
  targetBike: z.string().optional(),
  targetRun: z.string().optional(),
})
export type Step5Data = z.infer<typeof step5Schema>

// ── Step 6: Weekly Availability ───────────────────────────────────────────────
const dayKey = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
export type DayKey = z.infer<typeof dayKey>

export const step6Schema = z
  .object({
    availableDays: z.array(dayKey).min(2, 'daysRequired'),
    hoursPerDay: z
      .record(dayKey, z.coerce.number().min(0.5).max(6))
      .optional()
      .default({} as Record<DayKey, number>),
    timeOfDay: z.enum(['morning', 'lunch', 'afternoon', 'evening']),
  })
  .refine((d) => d.availableDays.length >= 2, { message: 'daysRequired', path: ['availableDays'] })
export type Step6Data = z.infer<typeof step6Schema>

// ── Step 7: Wearables (no required fields) ────────────────────────────────────
export const step7Schema = z.object({
  connectedProvider: z.enum(['garmin', 'wahoo', 'coros']).optional(),
})
export type Step7Data = z.infer<typeof step7Schema>

// ── Full onboarding data ──────────────────────────────────────────────────────
export const onboardingSchema = z.object({
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
  step7: step7Schema,
})
export type OnboardingData = z.infer<typeof onboardingSchema>

// ── Plan generation ───────────────────────────────────────────────────────────
export interface TrainingPhase {
  phase: 'base' | 'build' | 'peak' | 'taper'
  startDate: string
  endDate: string
  weeklyHours: number
  focusAreas: string[]
}

export interface GeneratedPlan {
  name: string
  weeksToRace: number
  phases: TrainingPhase[]
  firstWeekSessions: Array<{
    day: string
    discipline: 'swim' | 'bike' | 'run'
    durationMinutes: number
    zone: string
    description: string
  }>
}

/** Deterministic plan generator — no AI required for MVP */
export function generatePlan(data: OnboardingData): GeneratedPlan {
  const raceDate = new Date(data.step5.raceDate)
  const today = new Date()
  const totalDays = Math.floor((raceDate.getTime() - today.getTime()) / 86_400_000)
  const totalWeeks = Math.max(4, Math.floor(totalDays / 7))

  // Phase allocation by distance
  const phaseAlloc: Record<string, [number, number, number, number]> = {
    sprint: [0.4, 0.35, 0.15, 0.1],
    olympic: [0.4, 0.35, 0.15, 0.1],
    half_ironman: [0.35, 0.4, 0.15, 0.1],
    ironman: [0.35, 0.4, 0.15, 0.1],
  }

  const [baseRatio, buildRatio, peakRatio] = phaseAlloc[data.step5.distance] ?? [
    0.4, 0.35, 0.15, 0.1,
  ]

  const baseWeeks = Math.max(2, Math.round(totalWeeks * baseRatio))
  const buildWeeks = Math.max(2, Math.round(totalWeeks * buildRatio))
  const peakWeeks = Math.max(1, Math.round(totalWeeks * peakRatio))

  const addWeeks = (d: Date, w: number) =>
    new Date(d.getTime() + w * 7 * 86_400_000).toISOString().split('T')[0]!

  const cursor = today
  const phases: TrainingPhase[] = [
    {
      phase: 'base',
      startDate: cursor.toISOString().split('T')[0]!,
      endDate: addWeeks(cursor, baseWeeks),
      weeklyHours: Math.min(data.step4.weeklyHours * 0.85, 10),
      focusAreas: ['aerobic base', 'technique', 'consistency'],
    },
    {
      phase: 'build',
      startDate: addWeeks(cursor, baseWeeks),
      endDate: addWeeks(cursor, baseWeeks + buildWeeks),
      weeklyHours: Math.min(data.step4.weeklyHours * 1.1, 16),
      focusAreas: ['threshold', 'lactate', 'brick sessions'],
    },
    {
      phase: 'peak',
      startDate: addWeeks(cursor, baseWeeks + buildWeeks),
      endDate: addWeeks(cursor, baseWeeks + buildWeeks + peakWeeks),
      weeklyHours: Math.min(data.step4.weeklyHours * 1.2, 20),
      focusAreas: ['race-pace', 'intensity', 'simulation'],
    },
    {
      phase: 'taper',
      startDate: addWeeks(cursor, baseWeeks + buildWeeks + peakWeeks),
      endDate: data.step5.raceDate,
      weeklyHours: Math.max(data.step4.weeklyHours * 0.5, 4),
      focusAreas: ['freshness', 'activation', 'race prep'],
    },
  ]

  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const availableDays = data.step6.availableDays.sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
  )

  const firstWeekSessions = availableDays
    .slice(0, Math.min(6, availableDays.length))
    .map((day, i) => {
      const discipline = (['swim', 'bike', 'run', 'swim', 'bike', 'run'] as const)[i % 3]!
      return {
        day,
        discipline,
        durationMinutes: discipline === 'bike' ? 60 : 45,
        zone: 'Z2',
        description: `Easy ${discipline} — aerobic base, focus on form`,
      }
    })

  const distanceNames: Record<string, string> = {
    sprint: 'Sprint',
    olympic: 'Olympic',
    half_ironman: 'Half Ironman',
    ironman: 'Ironman',
  }

  return {
    name: `${distanceNames[data.step5.distance]} Training Plan — ${data.step5.raceName}`,
    weeksToRace: totalWeeks,
    phases,
    firstWeekSessions,
  }
}
