import { redirect } from 'next/navigation'
import { defaultLocale } from '@/lib/dictionaries'

export default function RootPage() {
  redirect(`/${defaultLocale}`)
}
