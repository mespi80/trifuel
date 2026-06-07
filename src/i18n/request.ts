import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is the locale from the URL segment ([lang] param).
  // Fall back to the default if somehow undefined or unsupported.
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'en' | 'es')) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../src/messages/${locale}.json`)).default,
  }
})
