'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { OnboardingProvider } from '@/lib/onboarding/store'
import type { Dictionary } from '@/lib/dictionaries'
import type { Locale } from '@/lib/dictionaries'
import { Step1Welcome } from './steps/step1-welcome'
import { Step2Athlete } from './steps/step2-athlete'
import { Step3Diet } from './steps/step3-diet'
import { Step4Training } from './steps/step4-training'
import { Step5Race } from './steps/step5-race'
import { Step6Availability } from './steps/step6-availability'
import { Step7Wearables } from './steps/step7-wearables'
import { Step8Plan } from './steps/step8-plan'

interface OnboardingShellProps {
  step: number
  dict: Dictionary
  locale: Locale
  lang: string
}

const TOTAL_STEPS = 8

export function OnboardingShell({ step, dict, locale, lang }: OnboardingShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = dict.onboarding

  const goToStep = useCallback(
    (s: number) => {
      router.push(`${pathname}?step=${s}`)
    },
    [router, pathname]
  )

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) goToStep(step + 1)
  }, [step, goToStep])

  const goBack = useCallback(() => {
    if (step > 1) goToStep(step - 1)
  }, [step, goToStep])

  const progressValue = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  const stepNames = [
    t.steps.welcome,
    t.steps.athleteProfile,
    t.steps.dietPreferences,
    t.steps.trainingBackground,
    t.steps.raceGoal,
    t.steps.weeklyAvailability,
    t.steps.wearables,
    t.steps.planGenerated,
  ]

  const stepProps = { dict, locale, lang, goNext, goBack }

  return (
    <OnboardingProvider>
      <div className="bg-background flex min-h-screen flex-col">
        {/* Header / Progress */}
        {step < TOTAL_STEPS && (
          <header className="bg-background/95 border-border sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
            <div className="mx-auto max-w-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">
                  {t.steps && stepNames[step - 1]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t.progress
                    .replace('{current}', String(step))
                    .replace('{total}', String(TOTAL_STEPS))}
                </span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          </header>
        )}

        {/* Step content */}
        <main className="flex flex-1 flex-col items-center justify-start px-4 py-8">
          <div className="w-full max-w-xl">
            {step === 1 && <Step1Welcome {...stepProps} />}
            {step === 2 && <Step2Athlete {...stepProps} />}
            {step === 3 && <Step3Diet {...stepProps} />}
            {step === 4 && <Step4Training {...stepProps} />}
            {step === 5 && <Step5Race {...stepProps} />}
            {step === 6 && <Step6Availability {...stepProps} />}
            {step === 7 && <Step7Wearables {...stepProps} />}
            {step === 8 && <Step8Plan {...stepProps} />}
          </div>
        </main>

        {/* Back button (steps 2-7) */}
        {step > 1 && step < 8 && (
          <div className="border-border bg-background/95 sticky bottom-0 border-t px-4 py-3 backdrop-blur">
            <div className="mx-auto max-w-xl">
              <Button variant="ghost" size="sm" onClick={goBack}>
                ← {t.back}
              </Button>
            </div>
          </div>
        )}
      </div>
    </OnboardingProvider>
  )
}
