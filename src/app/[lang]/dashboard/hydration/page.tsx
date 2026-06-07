import { getDictionary } from '@/lib/dictionaries'
import { getHydrationDay } from '@/actions/hydration'
import { HydrationClient } from './hydration-client'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function HydrationPage({ params }: PageProps) {
  const { lang } = await params

  const [dict, data] = await Promise.all([
    getDictionary(lang as 'en' | 'es'),
    getHydrationDay().catch(() => null),
  ])

  const t = dict.dashboard.hydration

  // Fallback when unauthenticated or DB unavailable
  const hydrationData = data ?? {
    logs: [],
    totalMl: 0,
    targetMl: 2450,
    baseMl: 2450,
    trainingMl: 0,
    electrolytes: { sodiumMg: 1500, potassiumMg: 3500, magnesiumMg: 320, trainingDay: false },
    sessions: [],
  }

  return <HydrationClient initial={hydrationData} t={t} />
}
