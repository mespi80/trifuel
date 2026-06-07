'use client'

import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'
import type { DashboardNutrition } from '@/actions/dashboard'

// ── SVG ring ───────────────────────────────────────────────────────────────────

const R = 26
const STROKE = 5
const CX = 32
const CY = 32
const CIRCUMFERENCE = 2 * Math.PI * R

function Ring({
  pct,
  color,
  label,
  actual,
  target,
  unit,
  t,
}: {
  pct: number
  color: string
  label: string
  actual: number
  target: number | null
  unit: string
  t: { of: string }
}) {
  const clamped = Math.min(1, Math.max(0, pct))
  const offset = CIRCUMFERENCE * (1 - clamped)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width={64} height={64} viewBox="0 0 64 64">
          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={STROKE} />
          {/* Progress */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {/* Percentage text */}
          <text
            x={CX}
            y={CY + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={700}
            fill={color}
          >
            {Math.round(clamped * 100)}%
          </text>
        </svg>
      </div>

      <div className="text-center">
        <p className="text-[11px] font-semibold text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400">
          {Math.round(actual)}
          {unit}
          {target !== null && (
            <>
              {' '}
              {t.of} {Math.round(target)}
              {unit}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  nutrition: string
  logFood: string
  carbs: string
  protein: string
  fat: string
  g: string
  of: string
  noTargets: string
}

interface Props {
  data: DashboardNutrition
  lang: string
  t: T
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NutritionRings({ data, lang, t }: Props) {
  const hasTargets = data.targetChoG !== null

  const macros = [
    {
      label: t.carbs,
      actual: data.choG,
      target: data.targetChoG,
      color: '#F97316',
      pct: data.targetChoG ? data.choG / data.targetChoG : 0,
    },
    {
      label: t.protein,
      actual: data.proteinG,
      target: data.targetProteinG,
      color: '#3B82F6',
      pct: data.targetProteinG ? data.proteinG / data.targetProteinG : 0,
    },
    {
      label: t.fat,
      actual: data.fatG,
      target: data.targetFatG,
      color: '#EAB308',
      pct: data.targetFatG ? data.fatG / data.targetFatG : 0,
    },
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">{t.nutrition}</h3>
        </div>
        <Link
          href={`/${lang}/dashboard/nutrition`}
          className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          {t.logFood}
        </Link>
      </div>

      {hasTargets ? (
        <div className="grid grid-cols-3 gap-2">
          {macros.map((m) => (
            <Ring
              key={m.label}
              pct={m.pct}
              color={m.color}
              label={m.label}
              actual={m.actual}
              target={m.target}
              unit={t.g}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="py-4 text-center">
          <div className="mb-3 grid grid-cols-3 gap-2 opacity-30">
            {macros.map((m) => (
              <Ring
                key={m.label}
                pct={m.pct}
                color={m.color}
                label={m.label}
                actual={m.actual}
                target={null}
                unit={t.g}
                t={t}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">{t.noTargets}</p>
        </div>
      )}
    </div>
  )
}
