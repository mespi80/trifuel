'use client'

import Link from 'next/link'
import { Waves, Bike, Timer, Zap, Dumbbell, Moon, PlayCircle, ChevronRight } from 'lucide-react'
import type { CalendarSession } from '@/actions/training'
import { cn } from '@/lib/utils'

// ── Discipline config ──────────────────────────────────────────────────────────

const DISC_CONFIG = {
  swim: { icon: Waves, color: '#3B82F6', bg: 'bg-blue-50', label: 'Swim' },
  bike: { icon: Bike, color: '#22C55E', bg: 'bg-green-50', label: 'Bike' },
  run: { icon: Timer, color: '#F97316', bg: 'bg-orange-50', label: 'Run' },
  brick: { icon: Zap, color: '#A855F7', bg: 'bg-purple-50', label: 'Brick' },
  strength: { icon: Dumbbell, color: '#EAB308', bg: 'bg-yellow-50', label: 'Strength' },
  recovery: { icon: Moon, color: '#6B7280', bg: 'bg-gray-50', label: 'Recovery' },
} as const

const ZONE_COLOR: Record<string, string> = {
  z1: '#22C55E',
  z2: '#3B82F6',
  z3: '#F59E0B',
  z4: '#F97316',
  z5: '#EF4444',
  z6: '#7C3AED',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  todayWorkout: string
  restDay: string
  restDayTip: string
  start: string
  noWorkout: string
  min: string
  intensity: string
  today: string
  viewPlan: string
  completed: string
  planned: string
  missed: string
  skipped: string
}

interface Props {
  sessions: CalendarSession[]
  lang: string
  t: T
}

// ── Rest day card ──────────────────────────────────────────────────────────────

function RestDayCard({ t }: { t: T }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Moon className="h-5 w-5 text-gray-400" />
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">{t.restDay}</h2>
      </div>
      <p className="text-sm leading-relaxed text-gray-600">{t.restDayTip}</p>
    </div>
  )
}

// ── Single session card ────────────────────────────────────────────────────────

function SessionCard({ session, lang, t }: { session: CalendarSession; lang: string; t: T }) {
  const cfg = DISC_CONFIG[session.discipline] ?? DISC_CONFIG.recovery
  const Icon = cfg.icon
  const isCompleted = session.status === 'completed'
  const zoneColor = session.intensityZone ? ZONE_COLOR[session.intensityZone] : undefined

  const statusLabel = {
    completed: t.completed,
    planned: t.planned,
    missed: t.missed,
    skipped: t.skipped,
  }[session.status]

  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        isCompleted ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-white shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', cfg.bg)}>
            <Icon className="h-5 w-5" style={{ color: cfg.color }} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 capitalize">{session.discipline}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {session.durationMinutes} {t.min}
              </span>
              {session.intensityZone && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs font-semibold uppercase" style={{ color: zoneColor }}>
                    {session.intensityZone.toUpperCase()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium',
            isCompleted
              ? 'bg-green-100 text-green-700'
              : session.status === 'missed'
                ? 'bg-red-50 text-red-500'
                : session.status === 'skipped'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-blue-50 text-blue-600'
          )}
        >
          {statusLabel}
        </span>
      </div>

      {session.objective && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-600">{session.objective}</p>
      )}

      {/* Start / View button */}
      {!isCompleted && (
        <Link
          href={`/${lang}/dashboard/training/${session.id}`}
          className={cn(
            'mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors',
            'text-white'
          )}
          style={{ backgroundColor: cfg.color }}
        >
          <PlayCircle className="h-4 w-4" />
          {t.start}
        </Link>
      )}
      {isCompleted && (
        <Link
          href={`/${lang}/dashboard/training/${session.id}`}
          className="mt-4 flex items-center justify-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          {t.viewPlan}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TodayWorkoutCard({ sessions, lang, t }: Props) {
  const activeSessions = sessions.filter((s) => s.discipline !== 'recovery')

  if (activeSessions.length === 0) {
    return <RestDayCard t={t} />
  }

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        {t.todayWorkout}
      </h2>
      {activeSessions.map((s) => (
        <SessionCard key={s.id} session={s} lang={lang} t={t} />
      ))}
    </div>
  )
}
