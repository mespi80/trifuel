import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  // URL prefix for every locale — /en/…, /es/…
  localePrefix: 'always',
})
