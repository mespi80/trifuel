'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboarding } from '@/lib/onboarding/store'
import { step6Schema, type Step6Data, type DayKey } from '@/lib/onboarding/schema'
import type { StepProps } from './step-props'

const ALL_DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const TIME_OPTIONS = ['morning', 'lunch', 'afternoon', 'evening'] as const

export function Step6Availability({ dict, goNext }: StepProps) {
  const t = dict.onboarding.step6
  const { state, dispatch } = useOnboarding()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step6Data>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step6Schema) as any,
    defaultValues: {
      availableDays: state.step6?.availableDays ?? [],
      hoursPerDay: state.step6?.hoursPerDay ?? {},
      timeOfDay: state.step6?.timeOfDay,
    },
  })

  const selectedDays = watch('availableDays') ?? []
  const selectedTime = watch('timeOfDay')

  function toggleDay(day: DayKey) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day]
    setValue('availableDays', next, { shouldValidate: true })
  }

  function onSubmit(data: Step6Data) {
    dispatch({ type: 'SET_STEP6', data })
    goNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* Days */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.daysLabel}</label>
        <div className="grid grid-cols-7 gap-1.5">
          {ALL_DAYS.map((day) => {
            const active = selectedDays.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-lg border py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {t.days[day]}
              </button>
            )
          })}
        </div>
        {errors.availableDays && (
          <p className="text-destructive text-xs">{t.errors.daysRequired}</p>
        )}
      </div>

      {/* Hours per selected day */}
      {selectedDays.length > 0 && (
        <div className="space-y-2">
          <label className="text-foreground text-sm font-medium">{t.hoursPerDayLabel}</label>
          <div className="space-y-2">
            {selectedDays.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-foreground w-8 text-sm font-medium">{t.days[day]}</span>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="6"
                  placeholder="1.5"
                  className="w-24"
                  {...register(`hoursPerDay.${day}`)}
                />
                <span className="text-muted-foreground text-xs">hrs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time of day */}
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium">{t.timeOfDayLabel}</label>
        <div className="grid grid-cols-2 gap-2">
          {TIME_OPTIONS.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setValue('timeOfDay', time, { shouldValidate: true })}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedTime === time
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <p
                className={`text-sm font-medium ${selectedTime === time ? 'text-primary' : 'text-foreground'}`}
              >
                {t.timeOfDayOptions[time]}
              </p>
            </button>
          ))}
        </div>
        {errors.timeOfDay && <p className="text-destructive text-xs">{t.errors.daysRequired}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full">
        {dict.onboarding.next}
      </Button>
    </form>
  )
}
