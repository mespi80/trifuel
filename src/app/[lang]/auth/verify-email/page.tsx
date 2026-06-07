import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { AuthCard } from '@/components/auth/auth-card'
import { VerifyClient } from './verify-client'
import { verifyEmailAction } from '@/actions/auth'

export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<'/[lang]/auth/verify-email'>) {
  const { lang } = await params
  const sp = await searchParams
  const token = (sp?.token as string | undefined) ?? ''
  const email = (sp?.email as string | undefined) ?? ''

  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  const t = dict.auth.verifyEmail

  // Attempt verification server-side on page load
  const initialResult = token
    ? await verifyEmailAction(token)
    : { success: false, error: 'tokenRequired' as const }

  return (
    <AuthCard title={t.title} subtitle={t.subtitle}>
      <VerifyClient
        t={t}
        token={token}
        email={email}
        locale={locale}
        initialResult={initialResult}
      />
    </AuthCard>
  )
}
