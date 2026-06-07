'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboarding } from '@/lib/onboarding/store'
import { step5Schema, type Step5Data } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

const DISTANCE_OPTIONS = ['sprint', 'olympic', 'half_ironman', 'ironman'] as const
type DistanceOption = (typeof DISTANCE_OPTIONS)[number]

const PRIORITY_OPTIONS = ['A', 'B', 'C'] as const

export function Step5Race({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step5
  const { state, dispatch } = useOnboarding()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step5Data>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step5Schema) as any,
    defaultValues: state.step5 ?? {},
  })

  const selectedDistance = watch('distance')
  const selectedPriority = watch('priority')

  function onSubmit(data: Step5Data) {
    dispatch({ type: 'SET_STEP5', data })
    goNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Distance */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.distanceLabel}</label>
        <div className="grid grid-cols-2 gap-2">
          {DISTANCE_OPTIONS.map((dist) => {
            const descKey = `${dist}Desc` as `${DistanceOption}Desc`
            return (
              <button
                key={dist}
                type="button"
                onClick={() => setValue('distance', dist, { shouldValidate: true })}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  selectedDistance === dist
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <p
                  className={`text-sm font-medium ${selectedDistance === dist ? 'text-primary' : 'text-foreground'}`}
                >
                  {t.distanceOptions[dist]}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">{t.distanceOptions[descKey]}</p>
              </button>
            )
          })}
        </div>
        {errors.distance && <p className="text-destructive text-xs">{t.errors.distanceRequired}</p>}
      </div>

      {/* Race name */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">{t.raceNameLabel}</label>
        <Input
          type="text"
          placeholder={t.raceNamePlaceholder}
          error={!!errors.raceName}
          {...register('raceName')}
        />
        {errors.raceName && <p className="text-destructive text-xs">{t.errors.raceNameRequired}</p>}
      </div>

      {/* Race date */}
      <div className="space-y-1.5">
        <label className="text-foreground text-sm font-medium">{t.raceDateLabel}</label>
        <Input type="date" error={!!errors.raceDate} {...register('raceDate')} />
        {errors.raceDate && (
          <p className="text-destructive text-xs">
            {errors.raceDate.message === 'raceDateFuture'
              ? t.errors.raceDateFuture
              : t.errors.raceDateRequired}
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.priorityLabel}</label>
        <div className="space-y-2">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue('priority', p, { shouldValidate: true })}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedPriority === p
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <p
                className={`text-sm font-medium ${selectedPriority === p ? 'text-primary' : 'text-foreground'}`}
              >
                {t.priorityOptions[p]}
              </p>
            </button>
          ))}
        </div>
        {errors.priority && <p className="text-destructive text-xs">{t.errors.priorityRequired}</p>}
      </div>

      {/* Optional target times */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.targetTimesLabel}</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Swim</label>
            <Input type="text" placeholder="0:45:00" {...register('targetSwim')} />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Bike</label>
            <Input type="text" placeholder="2:30:00" {...register('targetBike')} />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Run</label>
            <Input type="text" placeholder="1:45:00" {...register('targetRun')} />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full">
        {dict.onboarding.next}
      </Button>
    </form>
  )
}
