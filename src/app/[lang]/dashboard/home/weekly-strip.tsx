'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { CalendarSession } from '@/actions/training'

// ── Discipline dot colors ──────────────────────────────────────────────────────

const DISC_COLOR: Record<string, string> = {
  swim: '#3B82F6',
  bike: '#22C55E',
  run: '#F97316',
  brick: '#A855F7',
  strength: '#EAB308',
  recovery: '#6B7280',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  weekly: string
  today: string
  completed: string
  planned: string
  missed: string
  skipped: string
}

interface Props {
  weekSessions: CalendarSession[]
  weekStart: string // ISO Monday
  today: string // ISO today
  lang: string
  t: T
}

// ── Day cell ───────────────────────────────────────────────────────────────────

const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]!
}

function DayCell({
  date,
  dayIdx,
  sessions,
  isToday,
  lang,
}: {
  date: string
  dayIdx: number
  sessions: CalendarSession[]
  isToday: boolean
  lang: string
}) {
  const dayNum = new Date(date + 'T00:00:00').getDate()
  const activeSessions = sessions.filter((s) => s.discipline !== 'recovery')
  const allDone = activeSessions.length > 0 && activeSessions.every((s) => s.status === 'completed')
  const hasAny = activeSessions.length > 0

  return (
    <Link
      href={`/${lang}/dashboard/training`}
      className={cn(
        'flex min-w-[48px] flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-colors',
        isToday ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
      )}
    >
      {/* Day abbreviation */}
      <span
        className={cn(
          'text-[10px] font-medium uppercase',
          isToday ? 'text-blue-100' : 'text-gray-400'
        )}
      >
        {DAY_ABBR[dayIdx]}
      </span>

      {/* Date number */}
      <span className={cn('text-sm font-bold', isToday ? 'text-white' : 'text-gray-800')}>
        {dayNum}
      </span>

      {/* Session dots */}
      <div className="flex min-h-[16px] flex-col items-center gap-0.5">
        {activeSessions.slice(0, 3).map((s) => (
          <span
            key={s.id}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                s.status === 'completed'
                  ? (DISC_COLOR[s.discipline] ?? '#6B7280')
                  : isToday
                    ? 'rgba(255,255,255,0.6)'
                    : '#D1D5DB',
            }}
          />
        ))}
      </div>

      {/* Completion check for all-done days */}
      {allDone && !isToday && <span className="text-[10px] text-green-500">✓</span>}
      {!hasAny && <span className="h-1 w-1 rounded-full bg-gray-100" />}
    </Link>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WeeklyStrip({ weekSessions, weekStart, today, lang, t }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const sessionsByDate = days.reduce<Record<string, CalendarSession[]>>((acc, date) => {
    acc[date] = weekSessions.filter((s) => s.date === date)
    return acc
  }, {})

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        {t.weekly}
      </h3>
      <div className="scrollbar-hide flex gap-1 overflow-x-auto pb-1">
        {days.map((date, i) => (
          <DayCell
            key={date}
            date={date}
            dayIdx={i}
            sessions={sessionsByDate[date] ?? []}
            isToday={date === today}
            lang={lang}
          />
        ))}
      </div>
    </div>
  )
}
