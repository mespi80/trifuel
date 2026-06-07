import { cn } from '@/lib/utils'

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-100', className)} />
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-gray-100 bg-white p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}

// ── Workout card skeleton ──────────────────────────────────────────────────────

export function WorkoutSkeleton() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Bone className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Bone className="h-4 w-28" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="h-6 w-16 rounded-full" />
      </div>
      <Bone className="mt-4 h-3 w-full" />
      <Bone className="mt-1.5 h-3 w-3/4" />
      <Bone className="mt-4 h-10 w-full rounded-xl" />
    </Card>
  )
}

// ── Nutrition rings skeleton ───────────────────────────────────────────────────

export function NutritionSkeleton() {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <Bone className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Bone className="h-16 w-16 rounded-full" />
            <Bone className="h-3 w-12" />
            <Bone className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Hydration bar skeleton ─────────────────────────────────────────────────────

export function HydrationSkeleton() {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-20" />
      </div>
      <Bone className="h-3 w-full rounded-full" />
      <Bone className="mt-3 h-7 w-20 rounded-lg" />
    </Card>
  )
}

// ── Weekly strip skeleton ──────────────────────────────────────────────────────

export function WeekSkeleton() {
  return (
    <Card>
      <Bone className="mb-3 h-3 w-20" />
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Bone key={i} className="h-20 flex-1 rounded-xl" />
        ))}
      </div>
    </Card>
  )
}

// ── Full dashboard skeleton ────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      {/* Greeting */}
      <div className="space-y-1.5 pb-1">
        <Bone className="h-7 w-44" />
        <Bone className="h-4 w-24" />
      </div>
      <WorkoutSkeleton />
      <NutritionSkeleton />
      <HydrationSkeleton />
      <WeekSkeleton />
    </div>
  )
}
