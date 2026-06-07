'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Droplets, Plus } from 'lucide-react'
import { addHydrationLog } from '@/actions/hydration'
import type { DashboardHydration } from '@/actions/dashboard'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  hydration: string
  addWater: string
  ml: string
  of: string
}

interface Props {
  data: DashboardHydration
  lang: string
  t: T
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HydrationBar({ data, lang, t }: Props) {
  const [totalMl, setTotalMl] = useState(data.totalMl)
  const [isPending, startTransition] = useTransition()

  const pct = Math.min(100, Math.round((totalMl / data.targetMl) * 100))
  const color = pct >= 100 ? '#22C55E' : pct >= 60 ? '#3B82F6' : '#93C5FD'

  function handleAdd() {
    startTransition(async () => {
      await addHydrationLog(250, 'water')
      setTotalMl((prev) => prev + 250)
    })
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-800">{t.hydration}</h3>
        </div>
        <Link
          href={`/${lang}/dashboard/hydration`}
          className="text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          {totalMl} {t.ml} {t.of} {data.targetMl} {t.ml}
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Quick add +250ml button */}
      <button
        onClick={handleAdd}
        disabled={isPending}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
          'bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50'
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {t.addWater}
      </button>
    </div>
  )
}
