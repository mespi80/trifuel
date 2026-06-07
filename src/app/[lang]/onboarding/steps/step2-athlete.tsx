'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboarding } from '@/lib/onboarding/store'
import { step2Schema, type Step2Data } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

const SEX_OPTIONS = ['male', 'female', 'other'] as const

export function Step2Athlete({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step2
  const { state, dispatch } = useOnboarding()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step2Data>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step2Schema) as any,
    defaultValues: state.step2 ?? {},
  })

  const selectedSex = watch('sex')

  function onSubmit(data: Step2Data) {
    dispatch({ type: 'SET_STEP2', data })
    goNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Weight */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">
          {t.weightLabel} <span className="text-muted-foreground">({t.weightUnit})</span>
        </label>
        <Input
          type="number"
          step="0.1"
          placeholder="70"
          error={!!errors.weightKg}
          {...register('weightKg')}
        />
        {errors.weightKg && (
          <p className="text-destructive text-xs">
            {t.errors[(errors.weightKg.message as keyof typeof t.errors) ?? 'weightRequired'] ??
              errors.weightKg.message}
          </p>
        )}
      </div>

      {/* Height */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">
          {t.heightLabel} <span className="text-muted-foreground">({t.heightUnit})</span>
        </label>
        <Input
          type="number"
          step="1"
          placeholder="175"
          error={!!errors.heightCm}
          {...register('heightCm')}
        />
        {errors.heightCm && (
          <p className="text-destructive text-xs">
            {t.errors[(errors.heightCm.message as keyof typeof t.errors) ?? 'heightRequired'] ??
              errors.heightCm.message}
          </p>
        )}
      </div>

      {/* Date of birth */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">{t.dobLabel}</label>
        <Input type="date" error={!!errors.birthDate} {...register('birthDate')} />
        {errors.birthDate && (
          <p className="text-destructive text-xs">
            {t.errors[(errors.birthDate.message as keyof typeof t.errors) ?? 'dobRequired'] ??
              errors.birthDate.message}
          </p>
        )}
      </div>

      {/* Sex */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.sexLabel}</label>
        <div className="grid grid-cols-3 gap-2">
          {SEX_OPTIONS.map((sex) => (
            <button
              key={sex}
              type="button"
              onClick={() => setValue('sex', sex, { shouldValidate: true })}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                selectedSex === sex
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted bg-transparent'
              }`}
            >
              {t.sexOptions[sex]}
            </button>
          ))}
        </div>
        {errors.sex && <p className="text-destructive text-xs">{t.errors.sexRequired}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full">
        {dict.onboarding.next}
      </Button>
    </form>
  )
}
