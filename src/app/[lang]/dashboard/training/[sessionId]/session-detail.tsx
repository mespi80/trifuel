'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Timer,
  Zap,
  Target,
  Repeat2,
  Smartphone,
  Salad,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { updateSessionRpe, updateSessionNotes } from '@/actions/training'
import type { CalendarSession } from '@/actions/training'
import {
  DISCIPLINE_COLOR,
  DISCIPLINE_ICON,
  DISCIPLINE_LIGHT_BG,
  DISCIPLINE_TEXT,
  ZONE_COLORS,
} from '../discipline-config'
import type { Dictionary } from '@/lib/dictionaries'

interface SessionDetailProps {
  session: CalendarSession
  lang: string
  dict: Dictionary
}

const RPE_LABELS: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function formatSwimPace(secPer100m: number): string {
  const m = Math.floor(secPer100m / 60)
  const s = Math.round(secPer100m % 60)
  return `${m}:${String(s).padStart(2, '0')}/100m`
}

export function SessionDetail({ session, lang, dict }: SessionDetailProps) {
  const t = dict.dashboard.training.detail
  const Icon = DISCIPLINE_ICON[session.discipline]
  const color = DISCIPLINE_COLOR[session.discipline]
  const lightBg = DISCIPLINE_LIGHT_BG[session.discipline]
  const textColor = DISCIPLINE_TEXT[session.discipline]
  const zoneColor = session.intensityZone ? ZONE_COLORS[session.intensityZone] : null

  const isCompleted = session.status === 'completed'
  const isMissed = session.status === 'missed'
  const isPlanned = !isCompleted && !isMissed

  const [rpe, setRpe] = useState<number>(session.rpe ?? 5)
  const [rpeSaved, setRpeSaved] = useState(false)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [pushSent, setPushSent] = useState(false)
  const [, startTransition] = useTransition()

  const disciplineLabel =
    dict.dashboard.training.disciplines[session.discipline] ?? session.discipline

  const formattedDate = new Date(session.date + 'T00:00:00').toLocaleDateString(
    lang === 'es' ? 'es-ES' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  )

  function handleSaveRpe() {
    startTransition(async () => {
      await updateSessionRpe(session.id, rpe)
      setRpeSaved(true)
      setTimeout(() => setRpeSaved(false), 2000)
    })
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateSessionNotes(session.id, notes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    })
  }

  function handlePushToDevice() {
    // Stub — wearable push integration wired up separately
    setPushSent(true)
    setTimeout(() => setPushSent(false), 3000)
  }

  // Build planned-vs-actual chart data
  const chartData = buildChartData(session, t.comparison)

  // Nutrition tip key
  const nutritionTipKey = session.discipline as keyof typeof t.nutritionTips
  const nutritionTip = t.nutritionTips[nutritionTipKey]
  const recoveryMealKey = session.discipline as keyof typeof t.recoveryMeals
  const recoveryMeal = t.recoveryMeals[recoveryMealKey]

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Back link */}
      <Link
        href={`/${lang}/dashboard/training`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToCalendar}
      </Link>

      {/* Header card */}
      <div className={cn('rounded-2xl border p-5', lightBg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <h1 className={cn('text-xl font-bold', textColor)}>
                {isCompleted ? t.completedTitle : t.plannedTitle}
              </h1>
              <p className="text-sm text-gray-500">
                {disciplineLabel} · {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {isMissed && <AlertTriangle className="h-5 w-5 text-amber-500" />}
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap gap-3">
          <MetaBadge icon={<Timer className="h-3.5 w-3.5" />}>
            {session.durationMinutes} {t.minutes}
          </MetaBadge>
          {session.intensityZone && zoneColor && (
            <MetaBadge icon={<Zap className="h-3.5 w-3.5" />} className={zoneColor}>
              {dict.dashboard.training.zones[session.intensityZone]} ·{' '}
              {dict.dashboard.training.zoneLabels[session.intensityZone]}
            </MetaBadge>
          )}
          {session.rpe !== null && session.rpe !== undefined && (
            <MetaBadge icon={<Target className="h-3.5 w-3.5" />}>RPE {session.rpe}/10</MetaBadge>
          )}
        </div>

        {/* Objective */}
        {session.objective && (
          <p className="mt-3 text-sm text-gray-700 italic">{session.objective}</p>
        )}
      </div>

      {/* ── PLANNED VARIANT ── */}
      {(isPlanned || isMissed) && (
        <>
          {/* Interval structure */}
          {session.intervals && session.intervals.length > 0 && (
            <Section title={t.intervalStructure} icon={<Repeat2 className="h-4 w-4" />}>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {session.intervals.map((interval, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white px-4 py-3 text-sm">
                    <span className="w-6 text-center font-mono font-bold text-gray-900">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <span className="font-semibold">
                        {interval.reps} {t.intervals.reps}
                      </span>
                      {interval.distance && (
                        <span className="text-gray-600"> × {interval.distance}m</span>
                      )}
                      {interval.durationSeconds && (
                        <span className="text-gray-600">
                          {' '}
                          × {Math.floor(interval.durationSeconds / 60)}:
                          {String(interval.durationSeconds % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-right text-xs text-gray-500">
                      {interval.targetPace && (
                        <div>
                          {t.intervals.target}: {interval.targetPace}
                        </div>
                      )}
                      {interval.targetPower && (
                        <div>
                          {t.intervals.target}: {interval.targetPower}W
                        </div>
                      )}
                      {interval.targetHr && (
                        <div>
                          {t.intervals.target}: {interval.targetHr}bpm
                        </div>
                      )}
                      <div>
                        {Math.round(interval.restSeconds / 60)}min {t.intervals.rest}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pre-workout nutrition tip */}
          {nutritionTip && (
            <Section title={t.nutritionTip} icon={<Salad className="h-4 w-4" />}>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                {nutritionTip}
              </div>
            </Section>
          )}

          {/* Push to device */}
          <button
            onClick={handlePushToDevice}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all',
              pushSent
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            {pushSent ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> {t.pushSuccess}
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4" /> {t.pushToDevice}
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-400">{t.pushToDeviceHint}</p>
        </>
      )}

      {/* ── COMPLETED VARIANT ── */}
      {isCompleted && (
        <>
          {/* Interval structure (what was planned) */}
          {session.intervals && session.intervals.length > 0 && (
            <Section title={t.intervalStructure} icon={<Repeat2 className="h-4 w-4" />}>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                {session.intervals.map((interval, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white px-4 py-3 text-sm">
                    <span className="w-6 text-center font-mono font-bold text-gray-900">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <span className="font-semibold">
                        {interval.reps} {t.intervals.reps}
                      </span>
                      {interval.distance && (
                        <span className="text-gray-600"> × {interval.distance}m</span>
                      )}
                      {interval.durationSeconds && (
                        <span className="text-gray-600">
                          {' '}
                          × {Math.floor(interval.durationSeconds / 60)}:
                          {String(interval.durationSeconds % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-right text-xs text-gray-500">
                      {interval.targetPace && (
                        <div>
                          {t.intervals.target}: {interval.targetPace}
                        </div>
                      )}
                      {interval.targetPower && (
                        <div>
                          {t.intervals.target}: {interval.targetPower}W
                        </div>
                      )}
                      {interval.targetHr && (
                        <div>
                          {t.intervals.target}: {interval.targetHr}bpm
                        </div>
                      )}
                      <div>
                        {Math.round(interval.restSeconds / 60)}min {t.intervals.rest}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Planned vs Actual chart */}
          {chartData.length > 0 && (
            <Section title={t.comparison.title} icon={<BarChart className="h-4 w-4" />}>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="planned"
                      name={t.comparison.planned}
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name={t.comparison.actual}
                      fill={color}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Actual data summary */}
                {session.actualData && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {session.actualData.avgHr && (
                      <ActualStat label="Avg HR" value={`${session.actualData.avgHr} bpm`} />
                    )}
                    {session.actualData.avgPowerWatts && (
                      <ActualStat
                        label="Avg Power"
                        value={`${session.actualData.avgPowerWatts} W`}
                      />
                    )}
                    {session.actualData.normalizedPowerWatts && (
                      <ActualStat
                        label="NP"
                        value={`${session.actualData.normalizedPowerWatts} W`}
                      />
                    )}
                    {session.actualData.distanceMeters && (
                      <ActualStat
                        label="Distance"
                        value={`${(session.actualData.distanceMeters / 1000).toFixed(1)} km`}
                      />
                    )}
                    {session.actualData.avgPaceSecPerKm && (
                      <ActualStat
                        label="Avg Pace"
                        value={formatPace(session.actualData.avgPaceSecPerKm)}
                      />
                    )}
                    {session.actualData.avgPaceSecPer100m && (
                      <ActualStat
                        label="Swim Pace"
                        value={formatSwimPace(session.actualData.avgPaceSecPer100m)}
                      />
                    )}
                    {session.actualData.calories && (
                      <ActualStat label="Calories" value={`${session.actualData.calories} kcal`} />
                    )}
                    {session.actualData.tss && (
                      <ActualStat label="TSS" value={String(session.actualData.tss)} />
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* RPE slider */}
          <Section title={t.rpeLabel} icon={<Target className="h-4 w-4" />}>
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{dict.dashboard.training.detail.rpeScale['1']}</span>
                <span className="text-lg font-bold text-gray-900">{rpe}</span>
                <span>{dict.dashboard.training.detail.rpeScale['10']}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full accent-blue-600"
                style={{
                  background: `linear-gradient(to right, ${color} ${((rpe - 1) / 9) * 100}%, #e5e7eb ${((rpe - 1) / 9) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <span key={n}>{RPE_LABELS[n]}</span>
                ))}
              </div>
              <button
                onClick={handleSaveRpe}
                className={cn(
                  'w-full rounded-lg py-2 text-sm font-semibold transition-all',
                  rpeSaved
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {rpeSaved ? t.rpeSaved : t.rpeSaving.replace('…', '')}
              </button>
            </div>
          </Section>

          {/* Recovery meal */}
          {recoveryMeal && (
            <Section title={t.recoveryMeal} icon={<Salad className="h-4 w-4" />}>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                {recoveryMeal}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Notes — both variants */}
      <Section title={t.notes} icon={<StickyNote className="h-4 w-4" />}>
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSaveNotes}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              notesSaved
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {notesSaved ? '✓ Saved' : t.saveNotes}
          </button>
        </div>
      </Section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function MetaBadge({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-gray-200/60 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700',
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}

function ActualStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

// ── Chart data builder ────────────────────────────────────────────────────────

type ChartRow = { metric: string; planned: number; actual: number }

function buildChartData(
  session: CalendarSession,
  labels: { duration: string; hr: string; power: string; pace: string }
): ChartRow[] {
  const rows: ChartRow[] = []

  // Duration
  const actualDurationMin = session.actualData?.durationSeconds
    ? Math.round(session.actualData.durationSeconds / 60)
    : null
  if (actualDurationMin !== null) {
    rows.push({
      metric: labels.duration,
      planned: session.durationMinutes,
      actual: actualDurationMin,
    })
  }

  // Avg HR
  if (session.actualData?.avgHr) {
    rows.push({ metric: labels.hr, planned: 0, actual: session.actualData.avgHr })
  }

  // Avg Power
  if (session.actualData?.avgPowerWatts) {
    rows.push({ metric: labels.power, planned: 0, actual: session.actualData.avgPowerWatts })
  }

  return rows
}
