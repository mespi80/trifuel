'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CalendarSession } from '@/actions/training'
import { SessionCard } from './session-card'

interface MonthViewProps {
  year: number
  month: number // 0-indexed
  sessions: CalendarSession[]
  lang: string
  isPremium: boolean
  onDragStart: (e: React.DragEvent, sessionId: string) => void
  onDrop: (e: React.DragEvent, dateStr: string) => void
  t: {
    disciplines: Record<string, string>
    zones: Record<string, string>
    minutes: string
    weekDays: Record<string, string>
    noSessions: string
  }
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

export function MonthView({
  year,
  month,
  sessions,
  lang,
  isPremium,
  onDragStart,
  onDrop,
  t,
}: MonthViewProps) {
  const today = todayStr()

  // Build calendar grid
  const { cells } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    // getDay() returns 0=Sun…6=Sat; we want Mon=0
    const startDow = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: { dateStr: string; isCurrentMonth: boolean; day: number }[] = []

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      cells.push({ dateStr: toDateStr(prevYear, prevMonth, day), isCurrentMonth: false, day })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: toDateStr(year, month, d), isCurrentMonth: true, day: d })
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      cells.push({ dateStr: toDateStr(nextYear, nextMonth, d), isCurrentMonth: false, day: d })
    }

    return { cells }
  }, [year, month])

  const sessionsByDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {}
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = []
      map[s.date]!.push(s)
    }
    return map
  }, [sessions])

  return (
    <div className="flex h-full flex-col">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="py-2 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase"
          >
            {t.weekDays[key]}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-7 divide-x divide-y divide-gray-100">
        {cells.map(({ dateStr, isCurrentMonth, day }) => {
          const daySessions = sessionsByDate[dateStr] ?? []
          const isToday = dateStr === today

          return (
            <div
              key={dateStr}
              className={cn(
                'flex min-h-[100px] flex-col gap-1 p-1.5',
                !isCurrentMonth && 'bg-gray-50/50',
                isPremium && 'droppable'
              )}
              onDragOver={isPremium ? (e) => e.preventDefault() : undefined}
              onDrop={isPremium ? (e) => onDrop(e, dateStr) : undefined}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium',
                  isToday
                    ? 'bg-blue-600 text-white'
                    : isCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                )}
              >
                {day}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                {daySessions.slice(0, 3).map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    lang={lang}
                    compact
                    isDraggable={isPremium}
                    onDragStart={onDragStart}
                    t={t}
                  />
                ))}
                {daySessions.length > 3 && (
                  <span className="pl-1 text-[10px] text-gray-400">
                    +{daySessions.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
