import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getSubscriptionTier } from '@/actions/subscription'
import { DashboardShell } from './dashboard-shell'
import { SubscriptionProvider } from '@/contexts/subscription-context'
import { PwaCachePrimer } from '@/components/pwa-cache-primer'

export default async function DashboardLayout({
  children,
  params,
}: LayoutProps<'/[lang]/dashboard'>) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'

  const session = await auth()
  if (!session?.user) {
    redirect(`/${locale}/auth/login`)
  }

  const [dict, tier] = await Promise.all([getDictionary(locale), getSubscriptionTier()])

  return (
    <SubscriptionProvider tier={tier}>
      <PwaCachePrimer />
      <DashboardShell dict={dict} locale={locale} lang={lang}>
        {children}
      </DashboardShell>
    </SubscriptionProvider>
  )
}
