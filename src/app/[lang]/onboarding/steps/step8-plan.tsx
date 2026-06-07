'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useOnboarding } from '@/lib/onboarding/store'
import { generatePlan, type GeneratedPlan } from '@/lib/onboarding/schema'
import { saveOnboardingAction } from '@/actions/onboarding'
import type { StepProps } from './step-props'

const PHASE_COLORS: Record<string, string> = {
  base: 'bg-blue-500',
  build: 'bg-amber-500',
  peak: 'bg-orange-500',
  taper: 'bg-green-500',
}

const DISCIPLINE_ICONS: Record<string, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
}

export function Step8Plan({ dict, lang }: StepProps) {
  const t = dict.onboarding.step8
  const { getFullData } = useOnboarding()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [plan] = useState<GeneratedPlan | null>(() => {
    const data = getFullData()
    return data ? generatePlan(data) : null
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    const data = getFullData()
    if (!data) return

    startTransition(async () => {
      const result = await saveOnboardingAction(data)
      if (result.success) {
        setSaved(true)
        setTimeout(() => router.push(`/${lang}/dashboard`), 1200)
      } else {
        setError(result.error ?? 'serverError')
      }
    })
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
          <span className="text-2xl">⏳</span>
        </div>
        <p className="text-muted-foreground text-sm">{dict.onboarding.saving}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="space-y-2 py-4 text-center">
        <div className="bg-primary mx-auto flex size-16 items-center justify-center rounded-2xl shadow-lg">
          <span className="text-primary-foreground text-2xl font-bold">✓</span>
        </div>
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Plan name */}
      <div className="border-border bg-card space-y-1 rounded-xl border p-4">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{t.planNameLabel}</p>
        <p className="text-foreground font-semibold">{plan.name}</p>
        <p className="text-muted-foreground text-sm">
          {t.weeksLabel.replace('{n}', String(plan.weeksToRace))}
        </p>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          {t.phasesTitle}
        </h3>
        <div className="space-y-2">
          {plan.phases.map((phase) => {
            const start = new Date(phase.startDate)
            const end = new Date(phase.endDate)
            const weeks = Math.max(
              1,
              Math.round((end.getTime() - start.getTime()) / (7 * 86_400_000))
            )
            const pct = Math.round((weeks / plan.weeksToRace) * 100)

            return (
              <div
                key={phase.phase}
                className="border-border bg-card space-y-2 rounded-xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2.5 rounded-full ${PHASE_COLORS[phase.phase] ?? 'bg-primary'}`}
                    />
                    <span className="text-foreground text-sm font-medium capitalize">
                      {t.phases[phase.phase as keyof typeof t.phases] ?? phase.phase}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {weeks}w · {phase.weeklyHours.toFixed(1)} hrs/wk
                  </span>
                </div>
                <Progress value={pct} className="h-1" />
                <div className="flex flex-wrap gap-1">
                  {phase.focusAreas.map((area) => (
                    <span
                      key={area}
                      className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs capitalize"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* First week sessions */}
      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          {t.firstWeekTitle}
        </h3>
        <div className="space-y-2">
          {plan.firstWeekSessions.map((s, i) => (
            <div
              key={i}
              className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3"
            >
              <span className="text-lg">{DISCIPLINE_ICONS[s.discipline] ?? '🏋️'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium capitalize">{s.discipline}</p>
                <p className="text-muted-foreground truncate text-xs">{s.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-foreground text-sm font-medium">{s.durationMinutes} min</p>
                <p className="text-muted-foreground text-xs">{s.zone}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {error && <p className="text-destructive text-center text-xs">{dict.common.error}</p>}

      <Button size="lg" className="w-full" onClick={handleSave} disabled={isPending || saved}>
        {saved ? t.saved : isPending ? t.saving : t.ctaDashboard}
      </Button>
    </div>
  )
}
