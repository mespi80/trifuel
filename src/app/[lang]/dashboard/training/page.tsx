import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getSessionsForRange, getUserSubscriptionTier } from '@/actions/training'
import { TrainingCalendar } from './training-calendar'
import { FitImportButton } from './fit-import-button'

interface PageProps {
  params: Promise<{ lang: string }>
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  // Fetch 3-month window so calendar navigation doesn't require new server roundtrips
  const endDate = new Date(year, month + 2, 0) // last day of next month
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return { start, end }
}

export default async function TrainingPage({ params }: PageProps) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'
  const dict = await getDictionary(locale)

  const now = new Date()
  const { start, end } = getMonthRange(now.getFullYear(), now.getMonth())

  const [sessions, subscriptionTier] = await Promise.all([
    getSessionsForRange(start, end),
    getUserSubscriptionTier(),
  ])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">{dict.dashboard.training.title}</h1>
        <FitImportButton t={dict.dashboard.training.fitImport} />
      </header>
      <div className="flex-1 overflow-hidden">
        <TrainingCalendar
          initialSessions={sessions}
          isPremium={subscriptionTier === 'premium'}
          lang={lang}
          dict={dict}
        />
      </div>
    </div>
  )
}
