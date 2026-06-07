import { notFound } from 'next/navigation'
import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getSessionById } from '@/actions/training'
import { SessionDetail } from './session-detail'

interface PageProps {
  params: Promise<{ lang: string; sessionId: string }>
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { lang, sessionId } = await params
  const locale = isValidLocale(lang) ? lang : 'en'

  const [session, dict] = await Promise.all([getSessionById(sessionId), getDictionary(locale)])

  if (!session) notFound()

  return <SessionDetail session={session} lang={lang} dict={dict} />
}
