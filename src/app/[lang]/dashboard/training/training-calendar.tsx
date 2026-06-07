'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rescheduleSession } from '@/actions/training'
import type { CalendarSession } from '@/actions/training'
import { MonthView } from './month-view'
import { WeekView } from './week-view'
import type { Dictionary } from '@/lib/dictionaries'

interface TrainingCalendarProps {
  initialSessions: CalendarSession[]
  isPremium: boolean
  lang: string
  dict: Dictionary
}

type ViewMode = 'month' | 'week'

function getMonthName(month: number, months: Record<string, string>): string {
  return months[String(month)] ?? ''
}

/** Returns Monday of the ISO week containing `date` */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function TrainingCalendar({
  initialSessions,
  isPremium,
  lang,
  dict,
}: TrainingCalendarProps) {
  const t = dict.dashboard.training
  const now = new Date()

  const [view, setView] = useState<ViewMode>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(() => getMondayOf(now))
  const [sessions, setSessions] = useState<CalendarSession[]>(initialSessions)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Navigation
  const prevPeriod = () => {
    if (view === 'month') {
      if (month === 0) {
        setMonth(11)
        setYear((y) => y - 1)
      } else setMonth((m) => m - 1)
    } else {
      setWeekStart((ws) => {
        const d = new Date(ws)
        d.setDate(d.getDate() - 7)
        return d
      })
    }
  }

  const nextPeriod = () => {
    if (view === 'month') {
      if (month === 11) {
        setMonth(0)
        setYear((y) => y + 1)
      } else setMonth((m) => m + 1)
    } else {
      setWeekStart((ws) => {
        const d = new Date(ws)
        d.setDate(d.getDate() + 7)
        return d
      })
    }
  }

  const goToday = () => {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth())
    setWeekStart(getMondayOf(n))
  }

  // Drag-to-reschedule (premium only)
  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    if (!isPremium) {
      e.preventDefault()
      setDragError(t.dragDisabled)
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(sessionId)
    setDragError(null)
  }

  const handleDrop = (e: React.DragEvent, newDate: string) => {
    e.preventDefault()
    if (!isPremium || !draggingId) return
    const sessionId = draggingId
    setDraggingId(null)

    // Optimistic update
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, date: newDate } : s)))

    startTransition(async () => {
      const result = await rescheduleSession(sessionId, newDate)
      if (!result.ok) {
        // Revert on failure
        setSessions(initialSessions)
        setDragError(t.rescheduleError)
      }
    })
  }

  // Visible sessions for current period
  const visibleSessions = sessions.filter((s) => {
    if (view === 'month') {
      const d = new Date(s.date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    } else {
      const ws = weekStart.getTime()
      const we = ws + 7 * 86400000
      const sd = new Date(s.date + 'T00:00:00').getTime()
      return sd >= ws && sd < we
    }
  })

  // Week label: "Apr 7 – Apr 13, 2025"
  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const fmtOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const localTag = lang === 'es' ? 'es-ES' : 'en-US'
  const weekLabel = `${weekStart.toLocaleDateString(localTag, fmtOpts)} – ${weekEndDate.toLocaleDateString(localTag, { ...fmtOpts, year: 'numeric' })}`

  const cardT = {
    disciplines: t.disciplines as Record<string, string>,
    zones: t.zones as Record<string, string>,
    minutes: t.detail.minutes,
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3">
        {/* Title / period label */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevPeriod}
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
            aria-label={t.previousPeriod}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-gray-900">
            {view === 'month'
              ? `${getMonthName(month, t.months as Record<string, string>)} ${year}`
              : weekLabel}
          </span>
          <button
            onClick={nextPeriod}
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
            aria-label={t.nextPeriod}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="hidden rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 sm:flex"
          >
            {t.today}
          </button>
        </div>

        {/* View toggle + premium drag hint */}
        <div className="flex items-center gap-2">
          {!isPremium && (
            <span className="hidden items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400 md:flex">
              <Lock className="h-3 w-3" />
              {t.dragHint}
            </span>
          )}
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {t.monthView}
            </button>
            <button
              onClick={() => setView('week')}
              className={cn(
                'flex items-center gap-1.5 border-l border-gray-200 px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              {t.weekView}
            </button>
          </div>
        </div>
      </div>

      {/* Drag error toast */}
      {dragError && (
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {dragError}
        </div>
      )}

      {/* Calendar body */}
      <div className="flex-1 overflow-auto bg-white">
        {view === 'month' ? (
          <MonthView
            year={year}
            month={month}
            sessions={visibleSessions}
            lang={lang}
            isPremium={isPremium}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            t={{
              ...cardT,
              weekDays: t.weekDays as Record<string, string>,
              noSessions: t.noSessions,
            }}
          />
        ) : (
          <WeekView
            weekStart={weekStart}
            sessions={visibleSessions}
            lang={lang}
            isPremium={isPremium}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            t={{
              ...cardT,
              zoneLabels: t.zoneLabels as Record<string, string>,
              weekDaysFull: t.weekDaysFull as Record<string, string>,
              noSessions: t.noSessions,
              sessionStatus: t.sessionStatus as Record<string, string>,
            }}
          />
        )}
      </div>
    </div>
  )
}
