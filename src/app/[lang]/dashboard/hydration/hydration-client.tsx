'use client'

import { useState, useTransition } from 'react'
import { Droplets, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { addHydrationLog, removeHydrationLog } from '@/actions/hydration'
import type { HydrationDayData, HydrationLogEntry } from '@/actions/hydration'
import type { SessionHydrationGuide } from '@/ai/nutrition/hydration'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  title: string
  subtitle: string
  target: string
  logged: string
  remaining: string
  progress: string
  quickAdd: string
  glass: string
  bottle: string
  large: string
  glassMl: string
  bottleMl: string
  largeMl: string
  add: string
  adding: string
  logTitle: string
  noLogs: string
  remove: string
  electrolytes: string
  sodium: string
  potassium: string
  magnesium: string
  trainingDayNote: string
  sessionGuidance: string
  sessionGuidanceSubtitle: string
  water: string
  electrolyte: string
  other: string
  typeLabel: string
  ml: string
  noSessions: string
  sessionPre: string
  sessionDuring: string
  sessionPost: string
  sodiumTip: string
  sipTip: string
}

interface Props {
  initial: HydrationDayData
  t: T
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ totalMl, targetMl }: { totalMl: number; targetMl: number }) {
  const pct = Math.min(100, Math.round((totalMl / targetMl) * 100))
  const color = pct >= 100 ? '#22C55E' : pct >= 60 ? '#3B82F6' : '#F97316'
  return (
    <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Log entry row ──────────────────────────────────────────────────────────────

function LogRow({
  entry,
  onRemove,
  removing,
  t,
}: {
  entry: HydrationLogEntry
  onRemove: (id: string) => void
  removing: boolean
  t: T
}) {
  const time = new Date(entry.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const typeLabel =
    entry.type === 'water' ? t.water : entry.type === 'electrolyte' ? t.electrolyte : t.other
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <Droplets className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="font-medium text-gray-800">
          {entry.amountMl} {t.ml}
        </span>
        <span className="text-xs text-gray-400">{typeLabel}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{time}</span>
        <button
          onClick={() => onRemove(entry.id)}
          disabled={removing}
          aria-label={t.remove}
          className="text-gray-300 transition-colors hover:text-red-400 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Session guidance card ──────────────────────────────────────────────────────

function SessionCard({ guide, t }: { guide: SessionHydrationGuide; t: T }) {
  const [open, setOpen] = useState(false)

  const disciplineColor: Record<string, string> = {
    swim: '#3B82F6',
    bike: '#22C55E',
    run: '#F97316',
    brick: '#A855F7',
    strength: '#EAB308',
    recovery: '#6B7280',
  }
  const color = disciplineColor[guide.discipline] ?? '#6B7280'

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium text-gray-800 capitalize">{guide.discipline}</span>
          <span className="text-xs text-gray-400">{guide.durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-600">
            {guide.duringSessionMl} {t.ml}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-50 bg-gray-50/50 px-4 pb-3">
          <div className="mb-3 grid grid-cols-3 gap-3 pt-3">
            {[
              { label: t.sessionPre, value: `${guide.preMl} ${t.ml}` },
              { label: t.sessionDuring, value: `${guide.duringSessionMl} ${t.ml}` },
              { label: t.sessionPost, value: `${guide.postMl} ${t.ml}` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-sm font-bold text-gray-800">{value}</p>
                <p className="text-[11px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          {guide.sodiumMg > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-600">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t.sodiumTip
                  .replace('{mg}', String(guide.sodiumMg))
                  .replace('{sipMl}', String(guide.sipRateMl))
                  .replace('{sipMin}', String(guide.sipEveryMinutes))}
              </span>
            </div>
          )}
          {guide.sodiumMg === 0 && (
            <p className="text-xs text-gray-500">
              {t.sipTip
                .replace('{sipMl}', String(guide.sipRateMl))
                .replace('{sipMin}', String(guide.sipEveryMinutes))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Electrolyte panel ──────────────────────────────────────────────────────────

function ElectrolytePanel({ e, t }: { e: HydrationDayData['electrolytes']; t: T }) {
  const items = [
    { label: t.sodium, value: e.sodiumMg, unit: 'mg', color: '#F97316' },
    { label: t.potassium, value: e.potassiumMg, unit: 'mg', color: '#3B82F6' },
    { label: t.magnesium, value: e.magnesiumMg, unit: 'mg', color: '#22C55E' },
  ]
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-800">{t.electrolytes}</h3>
      </div>
      {e.trainingDay && <p className="mb-3 text-xs text-amber-600">{t.trainingDayNote}</p>}
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, value, unit, color }) => (
          <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-base font-bold" style={{ color }}>
              {value}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400">{unit}</p>
            <p className="text-[11px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main client component ──────────────────────────────────────────────────────

export function HydrationClient({ initial, t }: Props) {
  const [data, setData] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const pct = Math.min(100, Math.round((data.totalMl / data.targetMl) * 100))
  const remaining = Math.max(0, data.targetMl - data.totalMl)

  function handleAdd(amountMl: number, type: 'water' | 'electrolyte' | 'other' = 'water') {
    startTransition(async () => {
      const entry = await addHydrationLog(amountMl, type)
      setData((prev) => ({
        ...prev,
        logs: [entry, ...prev.logs],
        totalMl: prev.totalMl + amountMl,
      }))
    })
  }

  function handleRemove(id: string) {
    const entry = data.logs.find((l) => l.id === id)
    if (!entry) return
    setRemovingId(id)
    startTransition(async () => {
      await removeHydrationLog(id)
      setData((prev) => ({
        ...prev,
        logs: prev.logs.filter((l) => l.id !== id),
        totalMl: prev.totalMl - entry.amountMl,
      }))
      setRemovingId(null)
    })
  }

  const quickAddButtons = [
    { label: t.glass, sub: t.glassMl, amount: 250 },
    { label: t.bottle, sub: t.bottleMl, amount: 500 },
    { label: t.large, sub: t.largeMl, amount: 750 },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {/* Progress card */}
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: t.logged, value: `${data.totalMl} ${t.ml}` },
            { label: t.target, value: `${data.targetMl} ${t.ml}` },
            { label: t.remaining, value: `${remaining} ${t.ml}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
        <ProgressBar totalMl={data.totalMl} targetMl={data.targetMl} />
        <p className="text-center text-xs text-gray-400">
          {t.progress.replace('{pct}', String(pct))}
        </p>
      </div>

      {/* Quick add */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">{t.quickAdd}</h3>
        <div className="grid grid-cols-3 gap-3">
          {quickAddButtons.map(({ label, sub, amount }) => (
            <button
              key={label}
              onClick={() => handleAdd(amount)}
              disabled={isPending}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border-2 border-dashed py-4 transition-colors',
                'border-blue-100 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50'
              )}
            >
              <Droplets className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <span className="text-xs text-gray-400">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Electrolyte panel */}
      <ElectrolytePanel e={data.electrolytes} t={t} />

      {/* Session guidance */}
      {data.sessions.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-0.5 text-sm font-semibold text-gray-800">{t.sessionGuidance}</h3>
          <p className="mb-3 text-xs text-gray-400">{t.sessionGuidanceSubtitle}</p>
          <div className="space-y-2">
            {data.sessions.map((guide, i) => (
              <SessionCard key={i} guide={guide} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">{t.logTitle}</h3>
        {data.logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">{t.noLogs}</p>
        ) : (
          <div className="space-y-1.5">
            {data.logs.map((entry) => (
              <LogRow
                key={entry.id}
                entry={entry}
                onRemove={handleRemove}
                removing={removingId === entry.id}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
