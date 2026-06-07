import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function SettingsPage({ params }: PageProps) {
  const { lang } = await params
  redirect(`/${lang}/dashboard/settings/subscription`)
}
