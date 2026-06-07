import type { Dictionary } from '@/lib/dictionaries'
import type { Locale } from '@/lib/dictionaries'

export interface StepProps {
  dict: Dictionary
  locale: Locale
  lang: string
  goNext: () => void
  goBack: () => void
}
