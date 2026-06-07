'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, Timer, Repeat2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarSession } from '@/actions/training'
import {
  DISCIPLINE_LIGHT_BG,
  DISCIPLINE_TEXT,
  DISCIPLINE_COLOR,
  DISCIPLINE_ICON,
  ZONE_COLORS,
} from './discipline-config'

interface WeekViewProps {
  weekStart: Date // Monday of the week
  sessions: CalendarSession[]
  lang: string
  isPremium: boolean
  onDragStart: (e: React.DragEvent, sessionId: string) => void
  onDrop: (e: React.DragEvent, dateStr: string) => void
  t: {
    disciplines: Record<string, string>
    zones: Record<string, string>
    zoneLabels: Record<string, string>
    minutes: string
    weekDaysFull: Record<string, string>
    noSessions: string
    sessionStatus: Record<string, string>
  }
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return toDateStr(new Date())
}

function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatIntervalTarget(interval: CalendarSession['intervals'][number]): string {
  const parts: string[] = []
  if (interval.targetPace) parts.push(interval.targetPace)
  if (interval.targetPower) parts.push(`${interval.targetPower}W`)
  if (interval.targetHr) parts.push(`${interval.targetHr}bpm`)
  return parts.join(' / ')
}

export function WeekView({
  weekStart,
  sessions,
  lang,
  isPremium,
  onDragStart,
  onDrop,
  t,
}: WeekViewProps) {
  const today = todayStr()

  const days = useMemo(
    () =>
      DAY_KEYS.map((key, i) => {
        const date = addDays(weekStart, i)
        const dateStr = toDateStr(date)
        return { key, date, dateStr }
      }),
    [weekStart]
  )

  const sessionsByDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {}
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = []
      map[s.date]!.push(s)
    }
    return map
  }, [sessions])

  return (
    <div className="divide-y divide-gray-100">
      {days.map(({ key, date, dateStr }) => {
        const daySessions = sessionsByDate[dateStr] ?? []
        const isToday = dateStr === today
        const dayLabel = t.weekDaysFull[key]

        return (
          <div
            key={dateStr}
            className={cn('flex gap-4 p-4', isToday && 'bg-blue-50/50', isPremium && 'droppable')}
            onDragOver={isPremium ? (e) => e.preventDefault() : undefined}
            onDrop={isPremium ? (e) => onDrop(e, dateStr) : undefined}
          >
            {/* Date label */}
            <div className="w-20 shrink-0 pt-0.5">
              <div
                className={cn('text-sm font-semibold', isToday ? 'text-blue-600' : 'text-gray-900')}
              >
                {dayLabel}
              </div>
              <div className="text-xs text-gray-400">{formatDate(date, lang)}</div>
              {isToday && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />}
            </div>

            {/* Sessions */}
            <div className="flex-1 space-y-3">
              {daySessions.length === 0 ? (
                <p className="pt-1 text-xs text-gray-400 italic">{t.noSessions}</p>
              ) : (
                daySessions.map((session) => (
                  <WeekSessionCard
                    key={session.id}
                    session={session}
                    lang={lang}
                    isPremium={isPremium}
                    onDragStart={onDragStart}
                    t={t}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface WeekSessionCardProps {
  session: CalendarSession
  lang: string
  isPremium: boolean
  onDragStart: (e: React.DragEvent, sessionId: string) => void
  t: WeekViewProps['t']
}

function WeekSessionCard({ session, lang, isPremium, onDragStart, t }: WeekSessionCardProps) {
  const Icon = DISCIPLINE_ICON[session.discipline]
  const lightBg = DISCIPLINE_LIGHT_BG[session.discipline]
  const textColor = DISCIPLINE_TEXT[session.discipline]
  const color = DISCIPLINE_COLOR[session.discipline]
  const zoneColor = session.intensityZone ? ZONE_COLORS[session.intensityZone] : null
  const isCompleted = session.status === 'completed'
  const isMissed = session.status === 'missed'

  return (
    <Link
      href={`/${lang}/dashboard/training/${session.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-shadow hover:shadow-sm',
        lightBg,
        isMissed && 'opacity-70'
      )}
      draggable={isPremium}
      onDragStart={isPremium ? (e) => onDragStart(e, session.id) : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className={cn('text-sm leading-tight font-semibold', textColor)}>
              {t.disciplines[session.discipline]}
            </div>
            {session.objective && (
              <div className="line-clamp-1 text-xs text-gray-500">{session.objective}</div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isMissed && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs',
              isCompleted
                ? 'bg-green-100 text-green-700'
                : isMissed
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-white/70 text-gray-600'
            )}
          >
            {t.sessionStatus[session.status]}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Metadata row */}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" />
          {session.durationMinutes} {t.minutes}
        </span>
        {session.intensityZone && zoneColor && (
          <span className={cn('rounded px-1.5 py-0.5', zoneColor)}>
            {t.zones[session.intensityZone]} · {t.zoneLabels[session.intensityZone]}
          </span>
        )}
        {session.rpe !== null && session.rpe !== undefined && (
          <span className="text-gray-500">RPE {session.rpe}/10</span>
        )}
      </div>

      {/* Interval structure preview */}
      {session.intervals && session.intervals.length > 0 && (
        <div className="mt-2 border-t border-gray-200/60 pt-2">
          <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
            <Repeat2 className="h-3 w-3" />
            <span className="font-medium">Intervals</span>
          </div>
          <div className="space-y-0.5">
            {session.intervals.slice(0, 3).map((interval, i) => {
              const target = formatIntervalTarget(interval)
              const duration = interval.durationSeconds
                ? `${Math.round(interval.durationSeconds / 60)}min`
                : interval.distance
                  ? `${interval.distance}m`
                  : ''
              return (
                <div key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="font-mono text-gray-900">
                    {interval.reps}×{duration}
                  </span>
                  {target && <span className="text-gray-500">@ {target}</span>}
                  <span className="text-gray-400">
                    {Math.round(interval.restSeconds / 60)}min rest
                  </span>
                </div>
              )
            })}
            {session.intervals.length > 3 && (
              <div className="text-xs text-gray-400">+{session.intervals.length - 3} more sets</div>
            )}
          </div>
        </div>
      )}
    </Link>
  )
}
