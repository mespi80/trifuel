'use client'

import { cn } from '@/lib/utils'

interface RingProps {
  label: string
  current: number
  target: number
  unit: string
  color: string // e.g. '#3B82F6'
  trackColor: string // e.g. '#DBEAFE'
  size?: number
  strokeWidth?: number
}

function Ring({
  label,
  current,
  target,
  unit,
  color,
  trackColor,
  size = 96,
  strokeWidth = 9,
}: RingProps) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const fraction = target > 0 ? Math.min(1, current / target) : 0
  // Overage shows the ring as full plus a pulsing indicator
  const over = target > 0 && current > target
  const offset = circumference * (1 - fraction)
  const cx = size / 2
  const cy = size / 2
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-label={`${label}: ${current}${unit} of ${target}${unit}`}
        >
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
          {/* Progress */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm leading-tight font-bold text-gray-900">
            {current < 1000 ? current : `${(current / 1000).toFixed(1)}k`}
          </span>
          <span className="text-[10px] text-gray-400">{unit}</span>
        </div>

        {/* Over-target badge */}
        {over && (
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            !
          </span>
        )}
      </div>

      {/* Labels */}
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400">
          {current}
          {unit} / {target}
          {unit}
        </p>
      </div>
    </div>
  )
}

interface MacroRingsProps {
  choG: number
  proteinG: number
  fatG: number
  calories: number
  targetChoG: number
  targetProteinG: number
  targetFatG: number
  targetCalories: number
  t: {
    carbs: string
    protein: string
    fat: string
    calories: string
    g: string
    kcal: string
    of: string
  }
  className?: string
}

export function MacroRings({
  choG,
  proteinG,
  fatG,
  calories,
  targetChoG,
  targetProteinG,
  targetFatG,
  targetCalories,
  t,
  className,
}: MacroRingsProps) {
  const rings = [
    {
      label: t.carbs,
      current: Math.round(choG),
      target: Math.round(targetChoG),
      unit: t.g,
      color: '#F59E0B', // amber
      trackColor: '#FEF3C7',
    },
    {
      label: t.protein,
      current: Math.round(proteinG),
      target: Math.round(targetProteinG),
      unit: t.g,
      color: '#3B82F6', // blue
      trackColor: '#DBEAFE',
    },
    {
      label: t.fat,
      current: Math.round(fatG),
      target: Math.round(targetFatG),
      unit: t.g,
      color: '#22C55E', // green
      trackColor: '#DCFCE7',
    },
  ]

  const calFraction = targetCalories > 0 ? Math.min(1, calories / targetCalories) : 0
  const calPct = Math.round(calFraction * 100)

  return (
    <div className={cn('rounded-2xl border border-gray-100 bg-white p-5 shadow-sm', className)}>
      {/* Calorie banner */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{t.calories}</p>
          <p className="text-2xl leading-tight font-bold text-gray-900">
            {calories.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-gray-400">{t.kcal}</span>
          </p>
          <p className="text-xs text-gray-400">
            {t.of} {targetCalories.toLocaleString()} {t.kcal}
          </p>
        </div>
        <div className="text-right">
          <span
            className="text-2xl font-bold"
            style={{
              color: calPct >= 100 ? '#EF4444' : calPct >= 80 ? '#F59E0B' : '#22C55E',
            }}
          >
            {calPct}%
          </span>
        </div>
      </div>

      {/* Full-width calorie bar */}
      <div className="relative mb-5 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${calFraction * 100}%`,
            backgroundColor: calPct >= 100 ? '#EF4444' : calPct >= 80 ? '#F59E0B' : '#22C55E',
          }}
        />
      </div>

      {/* 3 macro rings */}
      <div className="flex items-center justify-around">
        {rings.map((ring) => (
          <Ring key={ring.label} {...ring} />
        ))}
      </div>
    </div>
  )
}
