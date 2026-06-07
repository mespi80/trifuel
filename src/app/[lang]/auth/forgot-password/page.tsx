import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { AuthCard } from '@/components/auth/auth-card'
import { ForgotForm } from './forgot-form'

export default async function ForgotPasswordPage({
  params,
}: PageProps<'/[lang]/auth/forgot-password'>) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  const t = dict.auth.forgotPassword

  return (
    <AuthCard title={t.title} subtitle={t.subtitle}>
      <ForgotForm t={t} locale={locale} />
    </AuthCard>
  )
}
