import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from './login-form'

export default async function LoginPage({ params }: PageProps<'/[lang]/auth/login'>) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  const t = dict.auth.login

  return (
    <AuthCard title={t.title} subtitle={t.subtitle}>
      <LoginForm t={t} locale={locale} />
    </AuthCard>
  )
}
