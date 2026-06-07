import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { SettingsNav } from './settings-nav'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

export default async function SettingsLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : 'en'
  const dict = await getDictionary(locale)

  return (
    <div className="pt-6">
      <div className="mx-auto max-w-4xl">
        <SettingsNav lang={locale} navT={dict.dashboard.settings.nav} />
      </div>
      {children}
    </div>
  )
}
