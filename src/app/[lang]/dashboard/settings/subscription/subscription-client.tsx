'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SubscriptionDetails } from '@/actions/subscription'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SubscriptionT {
  title: string
  currentPlan: string
  freePlan: string
  premiumPlan: string
  status: {
    active: string
    trialing: string
    past_due: string
    cancelled: string
    incomplete: string
  }
  periodEnd: string
  noPeriodEnd: string
  upgrade: string
  managePortal: string
  openingPortal: string
  upgradedBanner: string
  cancelledBanner: string
  benefits: string[]
  trialNote: string
}

interface Props {
  t: SubscriptionT
  sub: SubscriptionDetails | null
  lang: string
  upgraded: boolean
}

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: { color: 'text-green-700  bg-green-50  border-green-200', icon: CheckCircle2 },
  trialing: { color: 'text-blue-700   bg-blue-50   border-blue-200', icon: Clock },
  past_due: { color: 'text-amber-700  bg-amber-50  border-amber-200', icon: AlertCircle },
  cancelled: { color: 'text-gray-700   bg-gray-50   border-gray-200', icon: AlertCircle },
  incomplete: { color: 'text-gray-700   bg-gray-50   border-gray-200', icon: AlertCircle },
} as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: Date | null, locale: string): string {
  if (!d) return ''
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    d
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SubscriptionClient({ t, sub, lang, upgraded }: Props) {
  const [loadingPortal, setLoadingPortal] = useState(false)
  const router = useRouter()

  const isPremium = sub?.tier === 'premium'
  const status = sub?.status ?? 'active'
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  const StatusIcon = cfg.icon

  async function handlePortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setLoadingPortal(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t.title}</h1>

      {/* Success banner */}
      {upgraded && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          <p className="text-sm font-medium text-green-700">{t.upgradedBanner}</p>
        </div>
      )}

      {/* Plan card */}
      <div
        className={cn(
          'mb-6 rounded-2xl border p-6',
          isPremium
            ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm'
            : 'border-gray-200 bg-white'
        )}
      >
        {/* Plan header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-0.5 flex items-center gap-1.5">
              {isPremium && <Sparkles className="h-4 w-4 text-blue-500" />}
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                {t.currentPlan}
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {isPremium ? t.premiumPlan : t.freePlan}
            </p>
          </div>

          {/* Status badge */}
          {isPremium && (
            <div
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium',
                cfg.color
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {t.status[status]}
            </div>
          )}
        </div>

        {/* Period end */}
        {isPremium && sub?.periodEnd && (
          <p className="text-sm text-gray-500">
            {t.periodEnd}:{' '}
            <span className="font-medium text-gray-700">{formatDate(sub.periodEnd, lang)}</span>
          </p>
        )}

        {/* CTA */}
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          {isPremium ? (
            <button
              onClick={handlePortal}
              disabled={loadingPortal}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingPortal ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-400" />
                  {t.openingPortal}
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  {t.managePortal}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => router.push(`/${lang}/pricing`)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <ArrowUpRight className="h-4 w-4" />
              {t.upgrade}
            </button>
          )}
        </div>
      </div>

      {/* Premium benefits (shown to free users) */}
      {!isPremium && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-800">{t.premiumPlan}</p>
          </div>
          <ul className="mb-4 space-y-2">
            {t.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {b}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-400">{t.trialNote}</p>
        </div>
      )}
    </div>
  )
}
