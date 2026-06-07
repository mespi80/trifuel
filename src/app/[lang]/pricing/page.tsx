import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getSubscriptionTier } from '@/actions/subscription'
import { PricingClient } from './pricing-client'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function PricingPage({ params }: PageProps) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'

  const [dict, tier] = await Promise.all([
    getDictionary(locale),
    getSubscriptionTier().catch(() => 'free' as const),
  ])

  return <PricingClient t={dict.pricing} lang={locale} isPremium={tier === 'premium'} />
}
