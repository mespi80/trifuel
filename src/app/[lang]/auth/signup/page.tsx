import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { AuthCard } from '@/components/auth/auth-card'
import { SignUpForm } from './signup-form'

export default async function SignUpPage({ params }: PageProps<'/[lang]/auth/signup'>) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  const t = dict.auth.signup

  return (
    <AuthCard title={t.title} subtitle={t.subtitle}>
      <SignUpForm t={t} locale={locale} />
    </AuthCard>
  )
}
