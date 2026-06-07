import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getRecentFoodItems, getFrequentFoodItems } from '@/actions/nutrition'
import { FoodSearch } from './food-search'
import type { MealSlot } from '@/actions/nutrition'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ slot?: string; date?: string }>
}

const VALID_SLOTS: MealSlot[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'pre_workout',
  'intra_workout',
  'post_workout',
]

export default async function FoodSearchPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const { slot: slotParam, date: dateParam } = await searchParams
  const locale = isValidLocale(lang) ? lang : 'en'

  const today = new Date().toISOString().slice(0, 10)
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today
  const slot: MealSlot = VALID_SLOTS.includes(slotParam as MealSlot)
    ? (slotParam as MealSlot)
    : 'breakfast'

  const [dict, recentItems, frequentItems] = await Promise.all([
    getDictionary(locale),
    getRecentFoodItems(15),
    getFrequentFoodItems(15),
  ])

  return (
    <FoodSearch
      slot={slot}
      date={date}
      lang={lang}
      locale={locale}
      dict={dict}
      recentItems={recentItems}
      frequentItems={frequentItems}
    />
  )
}
