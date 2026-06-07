import type { Metadata } from 'next'
import { isValidLocale, defaultLocale, getDictionary } from '@/lib/dictionaries'

// Use explicit local prop types rather than the auto-generated LayoutProps<>
// to avoid stale .next/types cache errors during development.
type Props = { children: React.ReactNode; params: Promise<{ lang: string }> }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale
  const dict = await getDictionary(locale)
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  }
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params
  const locale = isValidLocale(lang) ? lang : defaultLocale

  // Set the lang attribute at the nearest wrapper so assistive tech
  // picks up the correct language for this locale subtree.
  return (
    <div lang={locale} className="contents">
      {children}
    </div>
  )
}
