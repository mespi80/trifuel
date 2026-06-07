'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Sparkles, X, CheckCircle2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/contexts/subscription-context'
import type { Feature } from '@/lib/features'

// ── Feature benefit copy ───────────────────────────────────────────────────────

const FEATURE_COPY: Record<Feature, { title: string; description: string; benefits: string[] }> = {
  adaptive_replanning: {
    title: 'Adaptive Replanning',
    description: 'Your plan automatically adjusts when life happens.',
    benefits: [
      'AI reschedules missed sessions intelligently',
      'Preserves training load balance',
      'Maintains race-day readiness',
    ],
  },
  drag_reschedule: {
    title: 'Drag-to-Reschedule Calendar',
    description: 'Drag any session to move it to a different day.',
    benefits: [
      'Instant visual calendar editing',
      'Smart load balancing on drop',
      'Conflict detection',
    ],
  },
  plan_phase_map: {
    title: 'Training Phase Overview',
    description: 'Visualize your entire periodization from base to taper.',
    benefits: [
      'Full phase timeline (Base → Build → Peak → Taper)',
      'Weekly volume targets per phase',
      'Race-day countdown integration',
    ],
  },
  availability_editor: {
    title: 'Weekly Availability Editor',
    description: 'Fine-tune your training schedule week by week.',
    benefits: [
      'Set training windows per day',
      'Block-out busy weeks',
      'AI auto-adjusts load to fit',
    ],
  },
  wearable_auto_sync: {
    title: 'Wearable Auto-Sync',
    description: 'Workouts from your device appear automatically in TriFuel.',
    benefits: [
      'Garmin, Wahoo & COROS supported',
      'Auto-matches to planned sessions',
      'Heart rate & power data captured',
    ],
  },
  micronutrient_panel: {
    title: 'Full Micronutrient Panel',
    description: 'Track all 15 vegan-critical micronutrients daily.',
    benefits: [
      'B12, iron, zinc, omega-3, calcium, vitamin D',
      'Deficiency alerts with food suggestions',
      'Trends over time',
    ],
  },
  meal_templates: {
    title: 'Meal Templates',
    description: 'Save and replay your favourite meals in seconds.',
    benefits: [
      'One-tap logging of complex meals',
      'Template library synced across days',
      'Pre-race meal planning',
    ],
  },
  supplement_recs: {
    title: 'Supplement Recommendations',
    description: 'Science-backed supplement stack for vegan triathletes.',
    benefits: [
      'Personalised to your micronutrient gaps',
      'Timing guide (pre/post workout)',
      'Brand-agnostic evidence summaries',
    ],
  },
  meal_suggestions: {
    title: 'AI Meal Suggestions',
    description: 'Never wonder what to eat after a hard session again.',
    benefits: [
      'Matches macros to your daily target',
      'Considers upcoming training sessions',
      '100% vegan whole-food options',
    ],
  },
  fueling_guide: {
    title: 'During-Session Fueling Guide',
    description: 'Real-time carb and hydration cues as you train.',
    benefits: [
      'Per-session gel/bar timing',
      'Race-nutrition simulation',
      'GI distress prevention tips',
    ],
  },
  pmc_chart: {
    title: 'Performance Management Chart',
    description: 'Track fitness, fatigue and form over 12 weeks.',
    benefits: [
      'CTL (Fitness) / ATL (Fatigue) / TSB (Form) curves',
      'Race-day marker with form projection',
      'Optimal load zones highlighted',
    ],
  },
  training_analytics: {
    title: 'Training Load Analytics',
    description: 'Weekly volume breakdown by discipline.',
    benefits: ['Swim / Bike / Run / Brick hours', 'Up to 1-year history', 'Trend identification'],
  },
  nutrition_analytics: {
    title: 'Nutrition Analytics',
    description: 'Weekly macro compliance and caloric balance.',
    benefits: [
      'Actual vs. target bar charts',
      '14-day caloric balance trend',
      'Macro compliance score',
    ],
  },
  body_composition: {
    title: 'Body Composition Trends',
    description: 'Weight and body-fat tracking with dual-axis chart.',
    benefits: [
      'Weight + body fat % over time',
      'Progress since first measurement',
      'Race-weight targeting',
    ],
  },
}

// ── Feature Gate Modal ─────────────────────────────────────────────────────────

interface FeatureGateModalProps {
  feature: Feature
  lang: string
  open: boolean
  onClose: () => void
}

function FeatureGateModal({ feature, lang, open, onClose }: FeatureGateModalProps) {
  const copy = FEATURE_COPY[feature]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Close
            className="absolute top-4 right-4 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-blue-600 uppercase">
                Premium Feature
              </p>
              <Dialog.Title className="text-base font-bold text-gray-900">
                {copy.title}
              </Dialog.Title>
            </div>
          </div>

          <p className="mb-4 text-sm text-gray-600">{copy.description}</p>

          {/* Benefits */}
          <ul className="mb-6 space-y-2">
            {copy.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {b}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href={`/${lang}/pricing`}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Premium
          </Link>
          <button
            onClick={onClose}
            className="mt-2 w-full py-2 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            Maybe later
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Lock badge (inline, non-blocking) ─────────────────────────────────────────

interface LockBadgeProps {
  feature: Feature
  lang: string
  className?: string
}

export function LockBadge({ feature, lang, className }: LockBadgeProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
          'bg-gray-100 text-[11px] font-medium text-gray-500',
          'transition-colors hover:bg-amber-50 hover:text-amber-600',
          className
        )}
        aria-label="Premium feature — click to learn more"
      >
        <Lock className="h-3 w-3" />
        Premium
      </button>
      <FeatureGateModal feature={feature} lang={lang} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// ── FeatureGate — wraps content, shows blurred overlay for free users ──────────

interface FeatureGateProps {
  feature: Feature
  lang: string
  /** If true, renders nothing instead of a blurred overlay */
  hideForFree?: boolean
  /** Optional custom locked state UI */
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function FeatureGate({
  feature,
  lang,
  hideForFree = false,
  fallback,
  children,
}: FeatureGateProps) {
  const { canAccess: check } = useSubscription()
  const [open, setOpen] = useState(false)

  if (check(feature)) return <>{children}</>

  if (hideForFree) return null

  if (fallback) return <>{fallback}</>

  return (
    <>
      {/* Blurred + locked overlay */}
      <div
        className="group relative cursor-pointer"
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Premium feature"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        {/* Blurred content */}
        <div className="pointer-events-none opacity-50 blur-[3px] select-none">{children}</div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm transition-colors group-hover:border-blue-300">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-900">{FEATURE_COPY[feature].title}</p>
              <p className="text-[10px] text-gray-500">Upgrade to unlock</p>
            </div>
          </div>
        </div>
      </div>

      <FeatureGateModal feature={feature} lang={lang} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// ── useFeatureGate — for programmatic gating ──────────────────────────────────

export function useFeatureGate(feature: Feature) {
  const { canAccess: check } = useSubscription()
  const [open, setOpen] = useState(false)

  return {
    allowed: check(feature),
    openModal: () => setOpen(true),
    modal: (lang: string) => (
      <FeatureGateModal feature={feature} lang={lang} open={open} onClose={() => setOpen(false)} />
    ),
  }
}
