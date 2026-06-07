import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getSubscription } from '@/actions/subscription'
import { SubscriptionClient } from './subscription-client'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ upgraded?: string }>
}

export default async function SubscriptionPage({ params, searchParams }: PageProps) {
  const [{ lang }, sp] = await Promise.all([params, searchParams])
  const locale = isValidLocale(lang) ? lang : 'en'

  const [dict, sub] = await Promise.all([
    getDictionary(locale),
    getSubscription().catch(() => null),
  ])

  return (
    <SubscriptionClient
      t={dict.dashboard.settings.subscription}
      sub={sub}
      lang={locale}
      upgraded={sp.upgraded === '1'}
    />
  )
}
