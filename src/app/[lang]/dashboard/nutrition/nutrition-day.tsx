'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MacroRings } from './macro-rings'
import { MealSlotCard } from './meal-slot-card'
import type { DailyNutritionLog, FoodLogRow, MealSlot } from '@/actions/nutrition'
import type { Dictionary } from '@/lib/dictionaries'

interface NutritionDayProps {
  initialLog: DailyNutritionLog
  lang: string
  locale: string
  dict: Dictionary
}

const MAIN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']
const ALL_SLOTS: MealSlot[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'pre_workout',
  'post_workout',
]

// Default macro targets — will be replaced by AI-generated targets once the
// macro calculator is wired to store nutritionTargets in the DB.
const DEFAULT_TARGETS = {
  choG: 300,
  proteinG: 140,
  fatG: 70,
  calories: 2400,
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(
  isoDate: string,
  locale: string,
  todayStr: string,
  t: { today: string }
): string {
  if (isoDate === todayStr) return t.today
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function NutritionDay({ initialLog, lang, locale, dict }: NutritionDayProps) {
  const t = dict.dashboard.nutrition
  const todayStr = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(initialLog.date)
  const [logs, setLogs] = useState<FoodLogRow[]>(initialLog.logs)
  const [showAll, setShowAll] = useState(false)

  // Totals computed from current logs
  const totals = logs.reduce(
    (acc, log) => {
      const q = log.quantity
      const m = log.foodItem.macros
      return {
        choG: Math.round((acc.choG + m.choG * q) * 10) / 10,
        proteinG: Math.round((acc.proteinG + m.proteinG * q) * 10) / 10,
        fatG: Math.round((acc.fatG + m.fatG * q) * 10) / 10,
        calories: acc.calories + Math.round(m.calories * q),
      }
    },
    { choG: 0, proteinG: 0, fatG: 0, calories: 0 }
  )

  const targets = initialLog.targets ?? DEFAULT_TARGETS

  // Date navigation — triggers a full server page refresh via URL
  function navigate(direction: -1 | 1) {
    const newDate = addDays(date, direction)
    setDate(newDate)
    // Navigate to same page with new date param — server refetches
    window.location.href = `/${lang}/dashboard/nutrition?date=${newDate}`
  }

  const handleRemoveLog = useCallback((logId: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== logId))
  }, [])

  const visibleSlots = showAll ? ALL_SLOTS : MAIN_SLOTS

  const mealCardT = {
    addFood: t.mealCard.addFood,
    empty: t.mealCard.empty,
    subtotal: t.mealCard.subtotal,
    remove: t.mealCard.remove,
    g: t.macros.g,
    kcal: t.macros.kcal,
  }

  const ringsT = {
    carbs: t.macros.carbs,
    protein: t.macros.protein,
    fat: t.macros.fat,
    calories: t.macros.calories,
    g: t.macros.g,
    kcal: t.macros.kcal,
    of: t.macros.of,
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-24">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label={t.previousDay}
          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-900 capitalize">
          {formatDateLabel(date, locale, todayStr, t)}
        </span>
        <button
          onClick={() => navigate(1)}
          aria-label={t.nextDay}
          disabled={date >= todayStr}
          className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Macro rings */}
      <MacroRings
        choG={totals.choG}
        proteinG={totals.proteinG}
        fatG={totals.fatG}
        calories={totals.calories}
        targetChoG={targets.choG}
        targetProteinG={targets.proteinG}
        targetFatG={targets.fatG}
        targetCalories={targets.calories}
        t={ringsT}
      />

      {/* Meal slot cards */}
      {visibleSlots.map((slot) => (
        <MealSlotCard
          key={slot}
          slot={slot}
          label={(t.meals as Record<string, string>)[slot] ?? slot}
          logs={logs.filter((l) => l.mealSlot === slot)}
          lang={lang}
          date={date}
          locale={locale}
          defaultOpen={MAIN_SLOTS.includes(slot)}
          onRemove={handleRemoveLog}
          t={mealCardT}
        />
      ))}

      {/* Show more / fewer slots */}
      <button
        onClick={() => setShowAll((v) => !v)}
        className="w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {showAll ? '▲ Show fewer meal slots' : '▼ Show all meal slots'}
      </button>
    </div>
  )
}
