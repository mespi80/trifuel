import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { AuthCard } from '@/components/auth/auth-card'
import { ResetForm } from './reset-form'

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<'/[lang]/auth/reset-password'>) {
  const { lang } = await params
  const sp = await searchParams
  const token = (sp?.token as string | undefined) ?? ''

  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  const t = dict.auth.resetPassword

  return (
    <AuthCard title={t.title} subtitle={t.subtitle}>
      <ResetForm t={t} token={token} locale={locale} />
    </AuthCard>
  )
}
