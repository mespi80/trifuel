import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries'
import { OnboardingShell } from './onboarding-shell'

export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps<'/[lang]/onboarding'>) {
  const { lang } = await params
  const sp = await searchParams
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)

  const stepParam = typeof sp.step === 'string' ? parseInt(sp.step, 10) : 1
  const step = isNaN(stepParam) || stepParam < 1 || stepParam > 8 ? 1 : stepParam

  return <OnboardingShell step={step} dict={dict} locale={locale} lang={lang} />
}
