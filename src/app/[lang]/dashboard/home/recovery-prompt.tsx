'use client'

import { useState } from 'react'
import { Utensils, X } from 'lucide-react'
import type { RecoveryPrompt as RecoveryPromptData } from '@/actions/dashboard'

// ── Types ──────────────────────────────────────────────────────────────────────

interface T {
  recoveryWindow: string
  recoveryWindowDesc: string
  suggestedMeal: string
  dismiss: string
}

interface Props {
  prompt: RecoveryPromptData
  mealText: string // pre-resolved meal string from dict
  t: T
}

// ── Discipline accent ──────────────────────────────────────────────────────────

const DISC_COLOR: Record<string, string> = {
  swim: '#3B82F6',
  bike: '#22C55E',
  run: '#F97316',
  brick: '#A855F7',
  strength: '#EAB308',
  recovery: '#6B7280',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RecoveryPrompt({ prompt, mealText, t }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const color = DISC_COLOR[prompt.discipline] ?? '#3B82F6'

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: `${color}30`, background: `${color}08` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Utensils className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{t.recoveryWindow}</p>
            <p className="text-xs text-gray-500">{t.recoveryWindowDesc}</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t.dismiss}
          className="mt-0.5 shrink-0 text-gray-300 transition-colors hover:text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 rounded-xl bg-white/70 p-3">
        <p className="mb-1 text-[11px] font-medium text-gray-500">{t.suggestedMeal}</p>
        <p className="text-xs leading-relaxed text-gray-700">{mealText}</p>
      </div>
    </div>
  )
}
