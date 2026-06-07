import { redirect } from 'next/navigation'
import { isValidLocale, defaultLocale } from '@/lib/dictionaries'

export default async function LangHomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  redirect(`/${locale}/auth/login`)
}
