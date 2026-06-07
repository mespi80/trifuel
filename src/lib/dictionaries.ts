import 'server-only'

export type Locale = 'en' | 'es'
export const locales: Locale[] = ['en', 'es']
export const defaultLocale: Locale = 'en'

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

const dictionaries = {
  en: () => import('@/messages/en.json').then((m) => m.default),
  es: () => import('@/messages/es.json').then((m) => m.default),
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]()
}
