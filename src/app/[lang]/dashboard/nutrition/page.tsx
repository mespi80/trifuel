import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getDailyNutritionLog } from '@/actions/nutrition'
import { NutritionDay } from './nutrition-day'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ date?: string }>
}

export default async function NutritionPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { date: dateParam } = await searchParams
  const locale = isValidLocale(lang) ? lang : 'en'

  const today = new Date().toISOString().slice(0, 10)
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today

  const [dict, log] = await Promise.all([getDictionary(locale), getDailyNutritionLog(date)])

  const safeLog = log ?? {
    date,
    logs: [],
    totals: { choG: 0, proteinG: 0, fatG: 0, calories: 0 },
    targets: null,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3.5">
        <h1 className="text-center text-lg font-bold text-gray-900">
          {dict.dashboard.nutrition.title}
        </h1>
      </header>
      <NutritionDay initialLog={safeLog} lang={lang} locale={locale} dict={dict} />
    </div>
  )
}
