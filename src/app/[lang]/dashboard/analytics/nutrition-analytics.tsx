'use client'

/**
 * Nutrition analytics:
 * 1. Weekly macro averages vs targets — grouped bar chart
 * 2. 14-day caloric balance — line chart
 * 3. Compliance score — radial gauge
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import type { ContentType } from 'recharts/types/component/Tooltip'
import type { NutritionAnalytics as NutritionAnalyticsData } from '@/actions/analytics'

// ── Helpers ────────────────────────────────────────────────────────────────────

function xTick(value: string): string {
  const d = new Date(value)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function dateTick(value: string): string {
  const d = new Date(value)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Shared tooltip entry type ──────────────────────────────────────────────────

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
  name?: string
  fill?: string
  stroke?: string
  color?: string
}

interface BaseTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

// ── Macro bar tooltip ──────────────────────────────────────────────────────────

function MacroTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="mb-0.5 flex justify-between gap-6">
          <span style={{ color: e.fill ?? e.stroke }}>{e.name}</span>
          <span className="font-medium text-gray-800">{Math.round(Number(e.value))} g</span>
        </div>
      ))}
    </div>
  )
}

// ── Balance tooltip ────────────────────────────────────────────────────────────

function BalanceTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="mb-0.5 flex justify-between gap-6">
          <span style={{ color: e.stroke }}>{e.name}</span>
          <span className="font-medium text-gray-800">{Math.round(Number(e.value))} kcal</span>
        </div>
      ))}
    </div>
  )
}

// ── Compliance Gauge (SVG arc) ─────────────────────────────────────────────────

function ComplianceGauge({
  score,
  byMacro,
  t,
}: {
  score: number
  byMacro: { cho: number; protein: number; fat: number }
  t: { compliance: string; complianceDesc: string; carbs: string; protein: string; fat: string }
}) {
  // SVG arc gauge — semi-circle, 0 at left, 100 at right
  const RADIUS = 60
  const CX = 80
  const CY = 75
  const circumference = Math.PI * RADIUS // semi-circle arc length
  const dashOffset = circumference * (1 - score / 100)

  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#F97316' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{t.compliance}</h3>
      <p className="mb-3 text-center text-xs text-gray-400">{t.complianceDesc}</p>

      <div className="relative">
        <svg width={160} height={90} viewBox="0 0 160 90">
          {/* Track */}
          <path
            d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={12}
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {/* Score text */}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize={26} fontWeight={700} fill={color}>
            {score}%
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize={11} fill="#9CA3AF">
            compliance
          </text>
          {/* 0 / 100 labels */}
          <text x={CX - RADIUS - 6} y={CY + 4} fontSize={10} fill="#9CA3AF" textAnchor="end">
            0
          </text>
          <text x={CX + RADIUS + 6} y={CY + 4} fontSize={10} fill="#9CA3AF">
            100
          </text>
        </svg>
      </div>

      {/* Per-macro breakdown */}
      <div className="mt-2 grid w-full grid-cols-3 gap-3 text-center">
        {[
          { label: t.carbs, value: byMacro.cho, color: '#F97316' },
          { label: t.protein, value: byMacro.protein, color: '#3B82F6' },
          { label: t.fat, value: byMacro.fat, color: '#EAB308' },
        ].map(({ label, value, color: c }) => (
          <div key={label} className="rounded-lg bg-gray-50 px-1 py-2">
            <p className="text-lg font-bold" style={{ color: c }}>
              {value}%
            </p>
            <p className="text-[11px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Merged weekly dataset for grouped bar ──────────────────────────────────────

interface MergedWeek {
  weekStart: string
  choActual?: number
  choTarget?: number
  proteinActual?: number
  proteinTarget?: number
  fatActual?: number
  fatTarget?: number
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  data: NutritionAnalyticsData
  t: {
    title: string
    macroChart: string
    actual: string
    target: string
    carbs: string
    protein: string
    fat: string
    calories: string
    caloricBalance: string
    intake: string
    expenditure: string
    balance: string
    compliance: string
    complianceDesc: string
    noData: string
  }
}

export function NutritionAnalyticsChart({ data, t }: Props) {
  const hasData = data.weeklyActual.length > 0 || data.caloricBalance.length > 0

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">{t.noData}</div>
    )
  }

  // ── Merge actual + target by weekStart ───────────────────────────────────
  const weekMap = new Map<string, MergedWeek>()
  for (const a of data.weeklyActual) {
    weekMap.set(a.weekStart, {
      weekStart: a.weekStart,
      choActual: a.choG,
      proteinActual: a.proteinG,
      fatActual: a.fatG,
    })
  }
  for (const t2 of data.weeklyTargets) {
    const existing = weekMap.get(t2.weekStart) ?? { weekStart: t2.weekStart }
    weekMap.set(t2.weekStart, {
      ...existing,
      choTarget: t2.choG,
      proteinTarget: t2.proteinG,
      fatTarget: t2.fatG,
    })
  }
  const mergedWeeks = Array.from(weekMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  )

  return (
    <div className="space-y-8">
      {/* 1. Macro grouped bar chart */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">{t.macroChart}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mergedWeeks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={xTick}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              unit=" g"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip content={((props: any) => <MacroTooltip {...props} />) as ContentType} />

            {/* Carbs */}
            <Bar dataKey="choActual" name={`${t.carbs} (${t.actual})`} fill="#F97316" barSize={6} />
            <Bar dataKey="choTarget" name={`${t.carbs} (${t.target})`} fill="#FDBA74" barSize={6} />
            {/* Protein */}
            <Bar
              dataKey="proteinActual"
              name={`${t.protein} (${t.actual})`}
              fill="#3B82F6"
              barSize={6}
            />
            <Bar
              dataKey="proteinTarget"
              name={`${t.protein} (${t.target})`}
              fill="#93C5FD"
              barSize={6}
            />
            {/* Fat */}
            <Bar dataKey="fatActual" name={`${t.fat} (${t.actual})`} fill="#EAB308" barSize={6} />
            <Bar dataKey="fatTarget" name={`${t.fat} (${t.target})`} fill="#FDE047" barSize={6} />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px]">
          {[
            { color: '#F97316', label: `${t.carbs} (${t.actual})` },
            { color: '#FDBA74', label: `${t.carbs} (${t.target})` },
            { color: '#3B82F6', label: `${t.protein} (${t.actual})` },
            { color: '#93C5FD', label: `${t.protein} (${t.target})` },
            { color: '#EAB308', label: `${t.fat} (${t.actual})` },
            { color: '#FDE047', label: `${t.fat} (${t.target})` },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-gray-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Caloric balance + 3. Compliance — side by side on larger screens */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Caloric balance */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">{t.caloricBalance}</h3>
          {data.caloricBalance.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={data.caloricBalance}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={dateTick}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  unit=" k"
                  tickFormatter={(v) => Math.round(Number(v) / 1000).toString()}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip content={((props: any) => <BalanceTooltip {...props} />) as ContentType} />
                <ReferenceLine y={0} stroke="#E5E7EB" />
                <Line
                  type="monotone"
                  dataKey="intake"
                  name={t.intake}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenditure"
                  name={t.expenditure}
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name={t.balance}
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
              {t.noData}
            </div>
          )}
          {data.caloricBalance.length > 0 && (
            <div className="mt-2 flex justify-center gap-4 text-[11px]">
              {[
                { color: '#3B82F6', label: t.intake },
                { color: '#EF4444', label: t.expenditure },
                { color: '#22C55E', label: t.balance },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-gray-500">
                  <span
                    className="inline-block h-0.5 w-3 rounded-full"
                    style={{ background: color }}
                  />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compliance gauge */}
        <div className="flex items-center justify-center">
          <ComplianceGauge
            score={data.complianceScore}
            byMacro={data.complianceByMacro}
            t={{
              compliance: t.compliance,
              complianceDesc: t.complianceDesc,
              carbs: t.carbs,
              protein: t.protein,
              fat: t.fat,
            }}
          />
        </div>
      </div>
    </div>
  )
}
