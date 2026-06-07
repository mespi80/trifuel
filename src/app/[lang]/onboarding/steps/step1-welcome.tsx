'use client'

import { Button } from '@/components/ui/button'
import type { StepProps } from './step-props'

export function Step1Welcome({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step1

  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      {/* Brand mark */}
      <div className="bg-primary flex size-20 items-center justify-center rounded-2xl shadow-lg">
        <span className="text-primary-foreground text-3xl font-bold">TF</span>
      </div>

      <div className="space-y-3">
        <h1 className="text-foreground text-3xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-base">{t.subtitle}</p>
      </div>

      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">{t.intro}</p>

      {/* Feature list */}
      <ul className="w-full max-w-sm space-y-3 text-left">
        {t.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              ✓
            </span>
            <span className="text-foreground text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Button size="lg" className="w-full max-w-sm" onClick={goNext}>
        {t.cta}
      </Button>
    </div>
  )
}
