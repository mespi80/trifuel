'use client'

/**
 * Body Composition chart — weight trend (left Y-axis) + body fat % (right Y-axis).
 * Uses Recharts ComposedChart with dual YAxis for mobile-responsive dual-metric display.
 */

import { useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ContentType } from 'recharts/types/component/Tooltip'
import { AddMeasurementModal } from './add-measurement-modal'
import type { BodyPoint } from '@/actions/analytics'

// ── Custom tooltip ─────────────────────────────────────────────────────────────

interface TProps {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number | string; stroke?: string }>
  label?: string
  weightLabel: string
  fatLabel: string
}

function CustomTooltip({ active, payload, label, weightLabel, fatLabel }: TProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[140px] rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">{label}</p>
      {payload.map((e) => {
        const isWeight = e.dataKey === 'weightKg'
        return (
          <div key={String(e.dataKey)} className="mb-0.5 flex justify-between gap-4">
            <span style={{ color: e.stroke ?? '#888' }}>{isWeight ? weightLabel : fatLabel}</span>
            <span className="font-medium text-gray-800">
              {e.value !== undefined ? `${e.value}${isWeight ? ' kg' : '%'}` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── X-axis formatter ───────────────────────────────────────────────────────────

function xTick(value: string): string {
  const d = new Date(value)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Summary stats ──────────────────────────────────────────────────────────────

function computeStats(points: BodyPoint[]) {
  const withWeight = points.filter((p) => p.weightKg !== null)
  const withFat = points.filter((p) => p.bodyFatPct !== null)

  if (withWeight.length === 0) return null

  const first = withWeight[0]!
  const last = withWeight[withWeight.length - 1]!
  const weightChange =
    last.weightKg !== null && first.weightKg !== null
      ? Math.round((last.weightKg - first.weightKg) * 10) / 10
      : null

  const firstFat = withFat[0]?.bodyFatPct ?? null
  const lastFat = withFat[withFat.length - 1]?.bodyFatPct ?? null
  const fatChange =
    lastFat !== null && firstFat !== null ? Math.round((lastFat - firstFat) * 10) / 10 : null

  return { weightChange, fatChange, currentWeight: last.weightKg, currentFat: lastFat }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  initialData: BodyPoint[]
  t: {
    title: string
    weight: string
    bodyFat: string
    addMeasurement: string
    dateLabel: string
    weightLabel: string
    fatLabel: string
    save: string
    saving: string
    saved: string
    cancel: string
    noData: string
  }
}

export function BodyCompositionChart({ initialData, t }: Props) {
  const [data, setData] = useState(initialData)

  function handleAdded(point: BodyPoint) {
    setData((prev) => {
      const next = [...prev, point]
      return next.sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  const stats = computeStats(data)

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
        </div>
        <AddMeasurementModal onAdded={handleAdded} t={t} />
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Current weight',
              value: stats.currentWeight !== null ? `${stats.currentWeight} kg` : '—',
              color: '#3B82F6',
            },
            {
              label: 'Current body fat',
              value: stats.currentFat !== null ? `${stats.currentFat}%` : '—',
              color: '#F97316',
            },
            {
              label: 'Weight change',
              value:
                stats.weightChange !== null
                  ? `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange} kg`
                  : '—',
              color: stats.weightChange !== null && stats.weightChange < 0 ? '#22C55E' : '#EF4444',
            },
            {
              label: 'Body fat change',
              value:
                stats.fatChange !== null
                  ? `${stats.fatChange > 0 ? '+' : ''}${stats.fatChange}%`
                  : '—',
              color: stats.fatChange !== null && stats.fatChange < 0 ? '#22C55E' : '#EF4444',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold" style={{ color }}>
                {value}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          {t.noData}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 40, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={xTick}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
              />

              {/* Left Y-axis: weight */}
              <YAxis
                yAxisId="left"
                orientation="left"
                domain={['auto', 'auto']}
                unit=" kg"
                tick={{ fontSize: 11, fill: '#3B82F6' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />

              {/* Right Y-axis: body fat % */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
                unit="%"
                tick={{ fontSize: 11, fill: '#F97316' }}
                tickLine={false}
                axisLine={false}
                width={36}
              />

              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={
                  ((props: any) => (
                    <CustomTooltip {...props} weightLabel={t.weight} fatLabel={t.bodyFat} />
                  )) as ContentType
                }
              />

              {/* Weight line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weightKg"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={true}
              />

              {/* Body fat line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bodyFatPct"
                stroke="#F97316"
                strokeWidth={2.5}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: '#F97316', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-3 flex justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="inline-block h-0.5 w-3 rounded-full bg-blue-500" />
              {t.weight}
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="inline-block h-0.5 w-3 rounded-full bg-orange-500" />
              {t.bodyFat} <span className="text-gray-400">(right axis)</span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
