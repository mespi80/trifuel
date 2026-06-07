'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/lib/onboarding/store'
import { step3Schema, type Step3Data } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

type DietOption = 'vegan' | 'vegetarian' | 'omnivore'

interface DietMeta {
  key: DietOption
  labelKey: DietOption
  descKey: `${DietOption}Desc`
}

const DIET_META: DietMeta[] = [
  { key: 'vegan', labelKey: 'vegan', descKey: 'veganDesc' },
  { key: 'vegetarian', labelKey: 'vegetarian', descKey: 'vegetarianDesc' },
  { key: 'omnivore', labelKey: 'omnivore', descKey: 'omnivoreDesc' },
]

export function Step3Diet({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step3
  const { state, dispatch } = useOnboarding()

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step3Data>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step3Schema) as any,
    defaultValues: {
      dietType: state.step3?.dietType,
      allergies: state.step3?.allergies ?? [],
    },
  })

  const selectedDiet = watch('dietType')
  const selectedAllergies = watch('allergies') ?? []

  function toggleAllergy(allergy: string) {
    const current = selectedAllergies
    const next = current.includes(allergy)
      ? current.filter((a) => a !== allergy)
      : [...current, allergy]
    setValue('allergies', next)
  }

  function onSubmit(data: Step3Data) {
    dispatch({ type: 'SET_STEP3', data })
    goNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Diet type */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.dietLabel}</label>
        <div className="space-y-2">
          {DIET_META.map(({ key, labelKey, descKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => setValue('dietType', key, { shouldValidate: true })}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedDiet === key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <p
                className={`text-sm font-medium ${selectedDiet === key ? 'text-primary' : 'text-foreground'}`}
              >
                {t.dietOptions[labelKey]}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{t.dietOptions[descKey]}</p>
            </button>
          ))}
        </div>
        {errors.dietType && <p className="text-destructive text-xs">{t.errors.dietRequired}</p>}
      </div>

      {/* Allergies */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.allergiesLabel}</label>
        <div className="flex flex-wrap gap-2">
          {t.commonAllergies.map((allergy) => {
            const active = selectedAllergies.includes(allergy)
            return (
              <button
                key={allergy}
                type="button"
                onClick={() => toggleAllergy(allergy)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {allergy}
              </button>
            )
          })}
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full">
        {dict.onboarding.next}
      </Button>
    </form>
  )
}
