'use client'

/**
 * Client-side tab shell for the analytics page.
 * Lazy-renders each panel — heavy chart components only mount when selected.
 */

import * as Tabs from '@radix-ui/react-tabs'
import { Activity, BarChart2, Apple, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PmcChart } from './pmc-chart'
import { TrainingLoadChart } from './training-load-chart'
import { NutritionAnalyticsChart } from './nutrition-analytics'
import { BodyCompositionChart } from './body-composition-chart'
import { FeatureGate } from '@/components/premium/feature-gate'
import { FEATURES } from '@/lib/features'
import type { PmcData, WeeklyLoadPoint, NutritionAnalytics, BodyPoint } from '@/actions/analytics'
import type { Dictionary } from '@/lib/dictionaries'

type AnalyticsT = Dictionary['dashboard']['analytics']

interface Props {
  pmc: PmcData
  trainingLoad: WeeklyLoadPoint[]
  nutrition: NutritionAnalytics
  body: BodyPoint[]
  t: AnalyticsT
  lang: string
}

const TAB_ICONS = {
  performance: Activity,
  training: BarChart2,
  nutrition: Apple,
  body: Scale,
}

export function AnalyticsTabs({ pmc, trainingLoad, nutrition, body, t, lang }: Props) {
  const tabs = ['performance', 'training', 'nutrition', 'body'] as const

  return (
    <Tabs.Root defaultValue="performance">
      {/* Tab list */}
      <Tabs.List className="scrollbar-none mb-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab]
          const label = t.tabs[tab as keyof typeof t.tabs]
          return (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className={cn(
                'flex min-w-[80px] flex-1 items-center justify-center gap-1.5',
                'rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all',
                'text-gray-500 hover:text-gray-700',
                'data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>

      {/* Panels */}
      <Tabs.Content value="performance" className="focus:outline-none">
        <FeatureGate feature={FEATURES.PMC_CHART} lang={lang}>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <PmcChart data={pmc} t={t.pmc} />
          </div>
        </FeatureGate>
      </Tabs.Content>

      <Tabs.Content value="training" className="focus:outline-none">
        <FeatureGate feature={FEATURES.TRAINING_ANALYTICS} lang={lang}>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <TrainingLoadChart initialData={trainingLoad} t={t.trainingLoad} />
          </div>
        </FeatureGate>
      </Tabs.Content>

      <Tabs.Content value="nutrition" className="focus:outline-none">
        <FeatureGate feature={FEATURES.NUTRITION_ANALYTICS} lang={lang}>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <NutritionAnalyticsChart data={nutrition} t={t.nutrition} />
          </div>
        </FeatureGate>
      </Tabs.Content>

      <Tabs.Content value="body" className="focus:outline-none">
        <FeatureGate feature={FEATURES.BODY_COMPOSITION} lang={lang}>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <BodyCompositionChart initialData={body} t={t.body} />
          </div>
        </FeatureGate>
      </Tabs.Content>
    </Tabs.Root>
  )
}
