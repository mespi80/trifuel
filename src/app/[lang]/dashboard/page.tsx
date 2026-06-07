import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getDashboardData } from '@/actions/dashboard'
import { TodayWorkoutCard } from './home/today-workout-card'
import { NutritionRings } from './home/nutrition-rings'
import { HydrationBar } from './home/hydration-bar'
import { WeeklyStrip } from './home/weekly-strip'
import { RecoveryPrompt } from './home/recovery-prompt'

interface PageProps {
  params: Promise<{ lang: string }>
}

// ── Time-of-day greeting ───────────────────────────────────────────────────────

function timeOfDay(t: { morning: string; afternoon: string; evening: string }): string {
  const h = new Date().getHours()
  if (h < 12) return t.morning
  if (h < 18) return t.afternoon
  return t.evening
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardHomePage({ params }: PageProps) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'

  const [dict, data] = await Promise.all([getDictionary(locale), getDashboardData()])

  const t = dict.dashboard.home
  const tT = dict.dashboard.training

  const greeting = t.greeting.replace('{timeOfDay}', timeOfDay(t))
  const firstName = data?.userName?.split(' ')[0] ?? null

  // Empty state data — shown before onboarding completes
  const dashData = data ?? {
    userName: null,
    today: new Date().toISOString().split('T')[0]!,
    todaySessions: [],
    weekSessions: [],
    weekStart: new Date().toISOString().split('T')[0]!,
    nutrition: {
      choG: 0,
      proteinG: 0,
      fatG: 0,
      calories: 0,
      targetChoG: null,
      targetProteinG: null,
      targetFatG: null,
      targetCalories: null,
    },
    hydration: { totalMl: 0, targetMl: 2450 },
    recoveryPrompt: null,
  }

  // Resolve recovery meal text from dict
  const recoveryMealText = dashData.recoveryPrompt
    ? ((tT.detail.recoveryMeals as Record<string, string>)[dashData.recoveryPrompt.discipline] ??
      '')
    : ''

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      {/* Greeting */}
      <div className="pb-1">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-gray-400">
          {new Date(dashData.today + 'T00:00:00').toLocaleDateString(locale, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Recovery prompt — above workout card so it's the first thing seen post-workout */}
      {dashData.recoveryPrompt && (
        <RecoveryPrompt
          prompt={dashData.recoveryPrompt}
          mealText={recoveryMealText}
          t={{
            recoveryWindow: t.recoveryWindow,
            recoveryWindowDesc: t.recoveryWindowDesc,
            suggestedMeal: t.suggestedMeal,
            dismiss: t.dismiss,
          }}
        />
      )}

      {/* Today's workout */}
      <TodayWorkoutCard
        sessions={dashData.todaySessions}
        lang={lang}
        t={{
          todayWorkout: t.todayWorkout,
          restDay: t.restDay,
          restDayTip: t.restDayTip,
          start: t.start,
          noWorkout: t.noWorkout,
          min: t.min,
          intensity: t.intensity,
          today: t.today,
          viewPlan: t.viewPlan,
          completed: t.completed,
          planned: t.planned,
          missed: t.missed,
          skipped: t.skipped,
        }}
      />

      {/* Nutrition rings */}
      <NutritionRings
        data={dashData.nutrition}
        lang={lang}
        t={{
          nutrition: t.nutrition,
          logFood: t.logFood,
          carbs: t.carbs,
          protein: t.protein,
          fat: t.fat,
          g: t.g,
          of: t.of,
          noTargets: t.noTargets,
        }}
      />

      {/* Hydration bar */}
      <HydrationBar
        data={dashData.hydration}
        lang={lang}
        t={{
          hydration: t.hydration,
          addWater: t.addWater,
          ml: t.ml,
          of: t.of,
        }}
      />

      {/* Weekly calendar strip */}
      <WeeklyStrip
        weekSessions={dashData.weekSessions}
        weekStart={dashData.weekStart}
        today={dashData.today}
        lang={lang}
        t={{
          weekly: t.weekly,
          today: t.today,
          completed: t.completed,
          planned: t.planned,
          missed: t.missed,
          skipped: t.skipped,
        }}
      />
    </div>
  )
}
