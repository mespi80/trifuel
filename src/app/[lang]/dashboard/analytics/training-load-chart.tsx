'use client'

/**
 * Training Load by Discipline — stacked bar chart with period selector.
 */

import { useState, useTransition } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ContentType } from 'recharts/types/component/Tooltip'
import { getTrainingLoadByDiscipline } from '@/actions/analytics'
import type { WeeklyLoadPoint, TrainingPeriod } from '@/actions/analytics'
import { cn } from '@/lib/utils'

// ── Discipline colors (mirrors discipline-config.ts) ─────────────────────────

const DISC_COLOR: Record<string, string> = {
  swim: '#3B82F6',
  bike: '#22C55E',
  run: '#F97316',
  brick: '#A855F7',
  strength: '#EAB308',
  recovery: '#6B7280',
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

interface TProps {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number; name?: string }>
  label?: string
  labels: Record<string, string>
}

function CustomTooltip({ active, payload, label, labels }: TProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, e) => s + (e.value ?? 0), 0)
  return (
    <div className="min-w-[140px] rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">{label}</p>
      {payload.map((e) =>
        e.value && e.value > 0 ? (
          <div key={String(e.dataKey)} className="mb-0.5 flex justify-between gap-4">
            <span
              style={{ color: DISC_COLOR[String(e.dataKey)] ?? '#888' }}
              className="font-medium"
            >
              {labels[String(e.dataKey)] ?? e.dataKey}
            </span>
            <span className="text-gray-700">{e.value} h</span>
          </div>
        ) : null
      )}
      <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5 font-semibold text-gray-800">
        <span>Total</span>
        <span>{Math.round(total * 10) / 10} h</span>
      </div>
    </div>
  )
}

// ── X-axis: short date ─────────────────────────────────────────────────────────

function xTick(value: string): string {
  const d = new Date(value)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Period selector ────────────────────────────────────────────────────────────

const PERIODS: TrainingPeriod[] = ['4w', '8w', '12w', '6m', '1y']

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  initialData: WeeklyLoadPoint[]
  t: {
    title: string
    subtitle: string
    period: string
    periods: Record<string, string>
    swim: string
    bike: string
    run: string
    brick: string
    strength: string
    recovery: string
    hours: string
    noData: string
  }
}

export function TrainingLoadChart({ initialData, t }: Props) {
  const [data, setData] = useState(initialData)
  const [period, setPeriod] = useState<TrainingPeriod>('12w')
  const [isPending, startTransition] = useTransition()

  const labels: Record<string, string> = {
    swim: t.swim,
    bike: t.bike,
    run: t.run,
    brick: t.brick,
    strength: t.strength,
    recovery: t.recovery,
  }

  function handlePeriod(p: TrainingPeriod) {
    setPeriod(p)
    startTransition(async () => {
      const next = await getTrainingLoadByDiscipline(p)
      setData(next)
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{t.subtitle}</p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              disabled={isPending}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t.periods[p] ?? p}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          {t.noData}
        </div>
      ) : (
        <>
          <div className={cn('transition-opacity duration-200', isPending && 'opacity-50')}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="weekStart"
                  tickFormatter={xTick}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  unit=" h"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip
                  content={
                    ((props: any) => <CustomTooltip {...props} labels={labels} />) as ContentType
                  }
                />
                {(['swim', 'bike', 'run', 'brick', 'strength', 'recovery'] as const).map((disc) => (
                  <Bar
                    key={disc}
                    dataKey={disc}
                    stackId="load"
                    fill={DISC_COLOR[disc]}
                    radius={disc === 'recovery' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Discipline legend */}
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
            {Object.entries(labels).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5 text-gray-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: DISC_COLOR[key] }}
                />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
