'use client'

import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarSession } from '@/actions/training'
import {
  DISCIPLINE_LIGHT_BG,
  DISCIPLINE_TEXT,
  DISCIPLINE_ICON,
  ZONE_COLORS,
} from './discipline-config'

interface SessionCardProps {
  session: CalendarSession
  lang: string
  compact?: boolean
  isDraggable?: boolean
  onDragStart?: (e: React.DragEvent, sessionId: string) => void
  t: {
    disciplines: Record<string, string>
    zones: Record<string, string>
    minutes: string
  }
}

export function SessionCard({
  session,
  lang,
  compact = false,
  isDraggable = false,
  onDragStart,
  t,
}: SessionCardProps) {
  const Icon = DISCIPLINE_ICON[session.discipline]
  const lightBg = DISCIPLINE_LIGHT_BG[session.discipline]
  const textColor = DISCIPLINE_TEXT[session.discipline]
  const zoneColor = session.intensityZone ? ZONE_COLORS[session.intensityZone] : null
  const isCompleted = session.status === 'completed'
  const isMissed = session.status === 'missed'

  const card = (
    <div
      className={cn(
        'relative rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
        lightBg,
        isDraggable && 'cursor-grab active:cursor-grabbing',
        compact ? 'truncate' : 'space-y-1'
      )}
      draggable={isDraggable}
      onDragStart={isDraggable && onDragStart ? (e) => onDragStart(e, session.id) : undefined}
    >
      {/* Status overlay */}
      {isCompleted && (
        <span className="absolute top-1 right-1 text-green-500">
          <CheckCircle2 className="h-3.5 w-3.5" aria-label="Completed" />
        </span>
      )}
      {isMissed && (
        <span className="absolute top-1 right-1 text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5" aria-label="Missed" />
        </span>
      )}

      <div className={cn('flex items-center gap-1', textColor)}>
        <Icon className="h-3 w-3 shrink-0" />
        {!compact && (
          <span className="truncate">
            {t.disciplines[session.discipline] ?? session.discipline}
          </span>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-gray-600">
            {session.durationMinutes}
            {t.minutes}
          </span>
          {session.intensityZone && zoneColor && (
            <span className={cn('rounded px-1 py-0.5 text-[10px] leading-tight', zoneColor)}>
              {t.zones[session.intensityZone] ?? session.intensityZone.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Missed overlay tint */}
      {isMissed && (
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-amber-50/60" />
      )}
    </div>
  )

  return (
    <Link href={`/${lang}/dashboard/training/${session.id}`} className="block" draggable={false}>
      {card}
    </Link>
  )
}
