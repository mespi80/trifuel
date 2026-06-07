'use client'

/**
 * Performance Management Chart — CTL / ATL / TSB over time.
 * Uses Recharts LineChart with a ReferenceLine on race day.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { ContentType } from 'recharts/types/component/Tooltip'
import { Info } from 'lucide-react'
import { useState } from 'react'
import type { PmcData } from '@/actions/analytics'

// ── Tooltip ────────────────────────────────────────────────────────────────────

interface MetricInfo {
  label: string
  color: string
  desc: string
}

interface RawTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number }>
  label?: string
  metrics: Record<string, MetricInfo>
}

function CustomTooltip({ active, payload, label, metrics }: RawTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[160px] rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-gray-800">{label}</p>
      {payload.map((entry) => {
        const key = entry.dataKey as string
        const meta = metrics[key]
        if (!meta) return null
        return (
          <div key={key} className="mb-1.5 flex items-start gap-2">
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: meta.color }}
            />
            <div>
              <span className="font-medium text-gray-700">{meta.label}: </span>
              <span style={{ color: meta.color }}>{entry.value}</span>
              <p className="mt-0.5 max-w-[180px] text-[10px] leading-tight text-gray-400">
                {meta.desc}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Legend dot ─────────────────────────────────────────────────────────────────

function LegendWithInfo({ metrics }: { metrics: Record<string, MetricInfo> }) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
      {Object.entries(metrics).map(([key, m]) => (
        <div
          key={key}
          className="relative flex cursor-default items-center gap-1.5"
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: m.color }} />
          <span className="font-medium text-gray-700">{m.label}</span>
          <Info className="h-3 w-3 text-gray-400" />
          {hovered === key && (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2 text-[11px] text-white shadow-xl">
              {m.desc}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── X-axis tick: show only every 7th point (weekly) ───────────────────────────

function xTickFormatter(value: string, index: number): string {
  if (index % 7 !== 0) return ''
  const d = new Date(value)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  data: PmcData
  t: {
    title: string
    subtitle: string
    fitness: string
    fatigue: string
    form: string
    fitnessDesc: string
    fatigueDesc: string
    formDesc: string
    tss: string
    raceDay: string
    noData: string
  }
}

export function PmcChart({ data, t }: Props) {
  const metrics: Record<string, MetricInfo> = {
    ctl: { label: t.fitness, color: '#3B82F6', desc: t.fitnessDesc },
    atl: { label: t.fatigue, color: '#EF4444', desc: t.fatigueDesc },
    tsb: { label: t.form, color: '#22C55E', desc: t.formDesc },
  }

  if (data.points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">{t.noData}</div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{t.subtitle}</p>
        {data.nextRaceName && data.nextRaceDate && (
          <p className="mt-1 text-xs text-blue-600">
            🏁 {data.nextRaceName} — {data.nextRaceDate}
          </p>
        )}
      </div>

      <LegendWithInfo metrics={metrics} />

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={
              ((props: any) => <CustomTooltip {...props} metrics={metrics} />) as ContentType
            }
          />

          {/* TSB zero line */}
          <ReferenceLine y={0} stroke="#D1D5DB" strokeDasharray="4 2" />

          {/* Race day */}
          {data.nextRaceDate && (
            <ReferenceLine
              x={data.nextRaceDate}
              stroke="#F97316"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{ value: t.raceDay, position: 'top', fontSize: 10, fill: '#F97316' }}
            />
          )}

          <Line
            type="monotone"
            dataKey="ctl"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="atl"
            stroke="#EF4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="tsb"
            stroke="#22C55E"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* TSB zone guide */}
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          Form &gt; 5: Fresh
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
          −10 to 5: Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          &lt; −10: Fatigued
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
          &gt; 25: Detraining
        </span>
      </div>
    </div>
  )
}
