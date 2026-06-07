'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X, Sparkles, Zap } from 'lucide-react'
import { STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL } from '@/lib/stripe'
import { cn } from '@/lib/utils'

// ── Feature comparison rows ────────────────────────────────────────────────────

const FEATURE_ROWS = [
  {
    category: 'Training',
    items: [
      { label: 'Training calendar with session details', free: true, premium: true },
      { label: 'Drag-to-reschedule calendar', free: false, premium: true },
      { label: 'Training phase overview (Base → Taper)', free: false, premium: true },
      { label: 'Weekly availability editor', free: false, premium: true },
      { label: 'Adaptive AI replanning', free: false, premium: true },
    ],
  },
  {
    category: 'Wearables',
    items: [
      { label: 'Manual workout import', free: true, premium: true },
      { label: 'Auto-sync from Garmin / Wahoo / COROS', free: false, premium: true },
    ],
  },
  {
    category: 'Nutrition',
    items: [
      { label: 'Daily macro tracking (CHO / protein / fat)', free: true, premium: true },
      { label: 'Food search & logging', free: true, premium: true },
      { label: 'Full micronutrient panel (15 nutrients)', free: false, premium: true },
      { label: 'Meal templates', free: false, premium: true },
      { label: 'AI meal suggestions', free: false, premium: true },
      { label: 'During-session fueling guide', free: false, premium: true },
      { label: 'Supplement recommendations', free: false, premium: true },
    ],
  },
  {
    category: 'Analytics',
    items: [
      { label: 'Hydration tracking', free: true, premium: true },
      { label: 'Performance Management Chart (CTL/ATL)', free: false, premium: true },
      { label: 'Training load analytics', free: false, premium: true },
      { label: 'Nutrition analytics & compliance', free: false, premium: true },
      { label: 'Body composition trends', free: false, premium: true },
    ],
  },
] as const

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PricingT {
  title: string
  subtitle: string
  billingToggle: { monthly: string; annual: string; saveLabel: string }
  free: { name: string; price: string; description: string; cta: string }
  premium: {
    name: string
    priceMonthly: string
    priceAnnual: string
    perMonth: string
    billedAnnually: string
    description: string
    cta: string
    trialNote: string
  }
  table: { feature: string; free: string; premium: string }
  faq: Array<{ q: string; a: string }>
  upgrading: string
  redirecting: string
}

interface Props {
  t: PricingT
  lang: string
  isPremium: boolean
}

// ── Check / X icons ────────────────────────────────────────────────────────────

function Check() {
  return <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" />
}

function Cross() {
  return <X className="mx-auto h-4 w-4 text-gray-300" />
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PricingClient({ t, lang, isPremium }: Props) {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleUpgrade() {
    if (isPremium) {
      router.push(`/${lang}/dashboard/settings/subscription`)
      return
    }
    setLoading(true)
    try {
      const priceId = annual ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, lang }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setLoading(false)
    }
  }

  const annualMonthly = (79.99 / 12).toFixed(2)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">{t.title}</h1>
        <p className="mx-auto max-w-xl text-gray-500">{t.subtitle}</p>
      </div>

      {/* Billing toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span className={cn('text-sm font-medium', !annual ? 'text-gray-900' : 'text-gray-400')}>
          {t.billingToggle.monthly}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((a) => !a)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
            annual ? 'bg-blue-600' : 'bg-gray-200'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              annual ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
        <span className={cn('text-sm font-medium', annual ? 'text-gray-900' : 'text-gray-400')}>
          {t.billingToggle.annual}
          <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 uppercase">
            {t.billingToggle.saveLabel}
          </span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="mb-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              {t.free.name}
            </p>
            <p className="text-3xl font-extrabold text-gray-900">{t.free.price}</p>
            <p className="mt-1 text-sm text-gray-500">{t.free.description}</p>
          </div>
          <div className="mt-auto pt-4">
            <div className="w-full cursor-default rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-400">
              {t.free.cta}
            </div>
          </div>
        </div>

        {/* Premium */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-blue-500 bg-gradient-to-b from-blue-50 to-white p-6 shadow-lg">
          {/* Popular badge */}
          <div className="absolute top-0 right-0">
            <div className="rounded-bl-xl bg-blue-500 px-3 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
              Popular
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
                {t.premium.name}
              </p>
            </div>
            <div className="flex items-end gap-1">
              <p className="text-3xl font-extrabold text-gray-900">
                ${annual ? annualMonthly : '9.99'}
              </p>
              <p className="mb-1 text-sm text-gray-500">{t.premium.perMonth}</p>
            </div>
            {annual && (
              <p className="text-xs text-gray-500">{t.premium.billedAnnually} — $79.99/yr</p>
            )}
            <p className="mt-1 text-sm text-gray-500">{t.premium.description}</p>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t.upgrading}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {isPremium ? 'Manage Subscription' : t.premium.cta}
                </>
              )}
            </button>
            {!isPremium && (
              <p className="text-center text-[11px] text-gray-400">{t.premium.trialNote}</p>
            )}
          </div>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="mb-14 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_72px_72px] gap-px bg-gray-100">
          <div className="bg-white px-5 py-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Feature
          </div>
          <div className="bg-white px-2 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Free
          </div>
          <div className="bg-blue-50 px-2 py-3 text-center text-xs font-semibold tracking-wide text-blue-600 uppercase">
            Premium
          </div>
        </div>

        {/* Rows by category */}
        {FEATURE_ROWS.map(({ category, items }) => (
          <div key={category}>
            {/* Category divider */}
            <div className="grid grid-cols-[1fr_72px_72px] gap-px bg-gray-100">
              <div className="col-span-3 bg-gray-50 px-5 py-2 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                {category}
              </div>
            </div>
            {items.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_72px_72px] gap-px bg-gray-100 last:border-b-0"
              >
                <div className="bg-white px-5 py-3 text-sm text-gray-700">{row.label}</div>
                <div className="flex items-center justify-center bg-white py-3">
                  {row.free ? <Check /> : <Cross />}
                </div>
                <div className="flex items-center justify-center bg-blue-50/50 py-3">
                  {row.premium ? <Check /> : <Cross />}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-center text-xl font-bold text-gray-900">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {t.faq.map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-gray-100 bg-white p-5">
              <p className="mb-1.5 font-semibold text-gray-900">{q}</p>
              <p className="text-sm text-gray-600">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
