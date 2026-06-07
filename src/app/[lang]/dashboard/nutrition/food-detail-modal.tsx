'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { cn } from '@/lib/utils'
import { addFoodLog } from '@/actions/nutrition'
import type { FoodItemData, MealSlot } from '@/actions/nutrition'

interface FoodDetailModalProps {
  food: FoodItemData | null
  slot: MealSlot
  date: string
  lang: string
  locale: string
  open: boolean
  onClose: () => void
  mealLabel: string
  t: {
    macroBreakdown: string
    micronutrients: string
    servingSize: string
    customServing: string
    addToMeal: string
    adding: string
    added: string
    perServing: string
    nutrients: Record<string, string>
  }
}

const MACRO_COLORS = {
  carbs: '#F59E0B',
  protein: '#3B82F6',
  fat: '#22C55E',
}

const SERVING_MULTIPLIERS = [0.5, 1, 1.5, 2, 3, 4]

interface MicroRow {
  key: string
  labelKey: string
  value: number | undefined
  unit: string
}

function buildMicroRows(micros: FoodItemData['micros']): MicroRow[] {
  return [
    { key: 'b12', labelKey: 'b12', value: micros.b12Mcg, unit: 'µg' },
    { key: 'iron', labelKey: 'iron', value: micros.ironMg, unit: 'mg' },
    { key: 'zinc', labelKey: 'zinc', value: micros.zincMg, unit: 'mg' },
    { key: 'omega3Ala', labelKey: 'omega3Ala', value: micros.omega3AlaMg, unit: 'mg' },
    { key: 'omega3Epa', labelKey: 'omega3Epa', value: micros.omega3EpaMg, unit: 'mg' },
    { key: 'omega3Dha', labelKey: 'omega3Dha', value: micros.omega3DhaMg, unit: 'mg' },
    { key: 'calcium', labelKey: 'calcium', value: micros.calciumMg, unit: 'mg' },
    { key: 'vitaminD', labelKey: 'vitaminD', value: micros.vitaminDIu, unit: 'IU' },
    { key: 'leucine', labelKey: 'leucine', value: micros.leucineMg, unit: 'mg' },
    { key: 'vitaminC', labelKey: 'vitaminC', value: micros.vitaminCMg, unit: 'mg' },
    { key: 'magnesium', labelKey: 'magnesium', value: micros.magnesiumMg, unit: 'mg' },
    { key: 'potassium', labelKey: 'potassium', value: micros.potassiumMg, unit: 'mg' },
    { key: 'folate', labelKey: 'folate', value: micros.folateMcg, unit: 'µg' },
    { key: 'iodine', labelKey: 'iodine', value: micros.iodineMcg, unit: 'µg' },
  ].filter((r) => r.value !== undefined && r.value > 0)
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function FoodDetailModal({
  food,
  slot,
  date,
  lang: _lang,
  locale,
  open,
  onClose,
  mealLabel,
  t,
}: FoodDetailModalProps) {
  const router = useRouter()
  const [multiplier, setMultiplier] = useState(1)
  const [customInput, setCustomInput] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [added, setAdded] = useState(false)
  const [, startTransition] = useTransition()

  const effectiveMultiplier = useCustom ? parseFloat(customInput) || 1 : multiplier

  const handleClose = useCallback(() => {
    setMultiplier(1)
    setCustomInput('')
    setUseCustom(false)
    setAdded(false)
    onClose()
  }, [onClose])

  function handleAdd() {
    if (!food) return
    startTransition(async () => {
      await addFoodLog(food.id, slot, effectiveMultiplier, date)
      setAdded(true)
      setTimeout(() => {
        handleClose()
        router.refresh()
      }, 800)
    })
  }

  if (!food) return null

  const m = food.macros
  const q = effectiveMultiplier
  const scaledMacros = {
    choG: round1(m.choG * q),
    proteinG: round1(m.proteinG * q),
    fatG: round1(m.fatG * q),
    calories: Math.round(m.calories * q),
    fiberG: round1(m.fiberG * q),
    sugarG: round1(m.sugarG * q),
  }

  const pieData = [
    {
      name: t.nutrients['carbs'] ?? 'Carbs',
      value: Math.max(0, m.choG * 4),
      color: MACRO_COLORS.carbs,
    },
    {
      name: t.nutrients['protein'] ?? 'Protein',
      value: Math.max(0, m.proteinG * 4),
      color: MACRO_COLORS.protein,
    },
    { name: t.nutrients['fat'] ?? 'Fat', value: Math.max(0, m.fatG * 9), color: MACRO_COLORS.fat },
  ].filter((d) => d.value > 0)

  const microRows = buildMicroRows(food.micros)
  const displayName = locale === 'es' && food.nameEs ? food.nameEs : food.nameEn
  const addLabel = t.addToMeal.replace('{slot}', mealLabel)
  const servingDisplay = `${round1(food.servingSize * q)}${food.servingUnit}`

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base leading-snug">
            {displayName}
            {food.brand && (
              <span className="mt-0.5 block text-xs font-normal text-gray-400">{food.brand}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Macro summary bar */}
        <div className="mt-1 grid grid-cols-4 gap-2">
          {[
            {
              label: t.nutrients['calories'] ?? 'Cal',
              value: scaledMacros.calories,
              unit: 'kcal',
              color: 'text-gray-900',
            },
            {
              label: t.nutrients['carbs'] ?? 'Carbs',
              value: scaledMacros.choG,
              unit: 'g',
              color: 'text-amber-600',
            },
            {
              label: t.nutrients['protein'] ?? 'Prot',
              value: scaledMacros.proteinG,
              unit: 'g',
              color: 'text-blue-600',
            },
            {
              label: t.nutrients['fat'] ?? 'Fat',
              value: scaledMacros.fatG,
              unit: 'g',
              color: 'text-green-600',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-gray-50 p-2.5 text-center">
              <p className={cn('text-base font-bold', item.color)}>{item.value}</p>
              <p className="text-[10px] text-gray-500">{item.label}</p>
              <p className="text-[9px] text-gray-400">{item.unit}</p>
            </div>
          ))}
        </div>

        {/* Macro Pie Chart */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {t.macroBreakdown}
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={66}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [`${Math.round(Number(value))} kcal`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Serving size selector */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {t.servingSize}
          </h3>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SERVING_MULTIPLIERS.map((mult) => (
              <button
                key={mult}
                onClick={() => {
                  setMultiplier(mult)
                  setUseCustom(false)
                }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  !useCustom && multiplier === mult
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                )}
              >
                {mult}×{' '}
                <span className="font-normal text-gray-400">
                  ({round1(food.servingSize * mult)}
                  {food.servingUnit})
                </span>
              </button>
            ))}
          </div>
          {/* Custom input */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t.customServing}
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value)
                setUseCustom(true)
              }}
              onFocus={() => setUseCustom(true)}
              className={cn(
                'h-9 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none',
                useCustom ? 'border-blue-400' : 'border-gray-200'
              )}
            />
            <span className="text-sm whitespace-nowrap text-gray-500">{servingDisplay}</span>
          </div>
        </section>

        {/* Micronutrient table */}
        {microRows.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {t.micronutrients}
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-50">
                  {microRows.map((row) => (
                    <tr key={row.key} className="flex justify-between px-3 py-2 even:bg-gray-50/50">
                      <td className="text-gray-600">{t.nutrients[row.labelKey] ?? row.labelKey}</td>
                      <td className="font-semibold text-gray-900 tabular-nums">
                        {round1((row.value ?? 0) * q)} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              {t.perServing} ({servingDisplay})
            </p>
          </section>
        )}

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={added}
          className={cn(
            'w-full rounded-xl py-3 text-sm font-semibold transition-all',
            added
              ? 'flex items-center justify-center gap-2 bg-green-100 text-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
          )}
        >
          {added ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> {t.added}
            </>
          ) : (
            addLabel
          )}
        </button>
      </DialogContent>
    </Dialog>
  )
}
