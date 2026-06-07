'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { removeFoodLog } from '@/actions/nutrition'
import type { FoodLogRow, MealSlot } from '@/actions/nutrition'

interface MealSlotCardProps {
  slot: MealSlot
  label: string
  logs: FoodLogRow[]
  lang: string
  date: string
  locale: string
  defaultOpen?: boolean
  onRemove: (logId: string) => void
  t: {
    addFood: string
    empty: string
    subtotal: string
    remove: string
    g: string
    kcal: string
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: '🌅',
  morning_snack: '🍎',
  lunch: '🥗',
  afternoon_snack: '🥜',
  dinner: '🍽️',
  pre_workout: '⚡',
  intra_workout: '🚴',
  post_workout: '💪',
}

export function MealSlotCard({
  slot,
  label,
  logs,
  lang,
  date,
  locale,
  defaultOpen = true,
  onRemove,
  t,
}: MealSlotCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [, startTransition] = useTransition()
  const [removing, setRemoving] = useState<string | null>(null)

  const subtotal = logs.reduce(
    (acc, log) => {
      const q = log.quantity
      const m = log.foodItem.macros
      return {
        choG: round1(acc.choG + m.choG * q),
        proteinG: round1(acc.proteinG + m.proteinG * q),
        fatG: round1(acc.fatG + m.fatG * q),
        calories: acc.calories + Math.round(m.calories * q),
      }
    },
    { choG: 0, proteinG: 0, fatG: 0, calories: 0 }
  )

  function handleRemove(logId: string) {
    setRemoving(logId)
    startTransition(async () => {
      await removeFoodLog(logId)
      onRemove(logId)
      setRemoving(null)
    })
  }

  const searchHref = `/${lang}/dashboard/nutrition/search?slot=${slot}&date=${date}`

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg" aria-hidden="true">
            {SLOT_ICONS[slot]}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            {logs.length > 0 && (
              <p className="text-xs text-gray-400">
                {subtotal.calories} {t.kcal} · {logs.length} item{logs.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 tabular-nums">
            {logs.length > 0
              ? `${round1(subtotal.choG)}g C · ${round1(subtotal.proteinG)}g P · ${round1(subtotal.fatG)}g F`
              : ''}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Food rows */}
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <UtensilsCrossed className="h-8 w-8 text-gray-200" />
              <p className="text-xs text-gray-400">{t.empty}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {logs.map((log) => {
                const q = log.quantity
                const m = log.foodItem.macros
                const displayName =
                  locale === 'es' && log.foodItem.nameEs ? log.foodItem.nameEs : log.foodItem.nameEn

                return (
                  <li
                    key={log.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 transition-opacity',
                      removing === log.id && 'pointer-events-none opacity-40'
                    )}
                  >
                    {/* Food info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-400">
                        {round1(q * log.foodItem.servingSize)}
                        {log.foodItem.servingUnit}
                        {' · '}
                        <span className="text-amber-600">{round1(m.choG * q)}g C</span>
                        {' · '}
                        <span className="text-blue-600">{round1(m.proteinG * q)}g P</span>
                        {' · '}
                        <span className="text-green-600">{round1(m.fatG * q)}g F</span>
                      </p>
                    </div>

                    {/* Calories */}
                    <span className="shrink-0 text-xs font-semibold text-gray-500 tabular-nums">
                      {Math.round(m.calories * q)} {t.kcal}
                    </span>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(log.id)}
                      aria-label={t.remove}
                      className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Subtotal row (only if items) */}
          {logs.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
              <span>{t.subtotal}</span>
              <div className="flex gap-3 tabular-nums">
                <span className="text-amber-600">{round1(subtotal.choG)}g C</span>
                <span className="text-blue-600">{round1(subtotal.proteinG)}g P</span>
                <span className="text-green-600">{round1(subtotal.fatG)}g F</span>
                <span className="text-gray-500">
                  {subtotal.calories} {t.kcal}
                </span>
              </div>
            </div>
          )}

          {/* Add food button */}
          <div className="px-4 py-3">
            <Link
              href={searchHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
              {t.addFood}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
