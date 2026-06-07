import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import {
  getPmcData,
  getTrainingLoadByDiscipline,
  getNutritionAnalytics,
  getBodyComposition,
} from '@/actions/analytics'
import { AnalyticsTabs } from './analytics-tabs'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'

  const [dict, pmc, trainingLoad, nutrition, body] = await Promise.all([
    getDictionary(locale),
    getPmcData(12).catch(() => ({ points: [], nextRaceDate: null, nextRaceName: null })),
    getTrainingLoadByDiscipline('12w').catch(() => []),
    getNutritionAnalytics(8).catch(() => ({
      weeklyActual: [],
      weeklyTargets: [],
      caloricBalance: [],
      complianceScore: 0,
      complianceByMacro: { cho: 0, protein: 0, fat: 0 },
    })),
    getBodyComposition(6).catch(() => []),
  ])

  const t = dict.dashboard.analytics

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
      </div>

      <AnalyticsTabs
        pmc={pmc}
        trainingLoad={trainingLoad}
        nutrition={nutrition}
        body={body}
        t={t}
        lang={locale}
      />
    </div>
  )
}
