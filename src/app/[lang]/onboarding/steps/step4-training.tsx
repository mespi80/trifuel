'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboarding } from '@/lib/onboarding/store'
import { step4Schema, type Step4Data } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

const EXPERIENCE_OPTIONS = ['beginner', 'intermediate', 'advanced', 'elite'] as const
type ExperienceOption = (typeof EXPERIENCE_OPTIONS)[number]

export function Step4Training({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step4
  const { state, dispatch } = useOnboarding()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step4Data>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step4Schema) as any,
    defaultValues: state.step4 ?? {},
  })

  const selectedExp = watch('experienceLevel')

  function onSubmit(data: Step4Data) {
    dispatch({ type: 'SET_STEP4', data })
    goNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Experience level */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.experienceLabel}</label>
        <div className="space-y-2">
          {EXPERIENCE_OPTIONS.map((exp) => {
            const descKey = `${exp}Desc` as `${ExperienceOption}Desc`
            return (
              <button
                key={exp}
                type="button"
                onClick={() => setValue('experienceLevel', exp, { shouldValidate: true })}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedExp === exp
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <p
                  className={`text-sm font-medium ${selectedExp === exp ? 'text-primary' : 'text-foreground'}`}
                >
                  {t.experienceOptions[exp]}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t.experienceOptions[descKey]}
                </p>
              </button>
            )
          })}
        </div>
        {errors.experienceLevel && (
          <p className="text-destructive text-xs">{t.errors.experienceRequired}</p>
        )}
      </div>

      {/* Weekly hours */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">
          {t.weeklyHoursLabel} <span className="text-muted-foreground">({t.weeklyHoursUnit})</span>
        </label>
        <Input
          type="number"
          step="0.5"
          min="1"
          max="40"
          placeholder="8"
          error={!!errors.weeklyHours}
          {...register('weeklyHours')}
        />
        {errors.weeklyHours && (
          <p className="text-destructive text-xs">{t.errors.weeklyHoursRequired}</p>
        )}
      </div>

      {/* Optional times */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium">{t.recentTimesLabel}</p>
          <p className="text-muted-foreground text-xs">{t.recentTimesHint}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium">{t.swimPaceLabel}</label>
            <Input type="text" placeholder={t.swimPacePlaceholder} {...register('swimPace')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium">{t.ftp}</label>
            <Input type="number" placeholder={t.ftpPlaceholder} {...register('ftp')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium">{t.runPaceLabel}</label>
            <Input type="text" placeholder={t.runPacePlaceholder} {...register('runPace')} />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full">
        {dict.onboarding.next}
      </Button>
    </form>
  )
}
