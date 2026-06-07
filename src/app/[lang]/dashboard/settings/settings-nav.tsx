'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CreditCard, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  lang: string
  navT: { subscription: string; devices: string }
}

const ITEMS = [
  { key: 'subscription' as const, icon: CreditCard, segment: 'subscription' },
  { key: 'devices' as const, icon: Cpu, segment: 'devices' },
]

export function SettingsNav({ lang, navT }: Props) {
  const pathname = usePathname()

  return (
    <nav className="mb-6 flex gap-1 border-b border-gray-200 px-4 sm:px-6">
      {ITEMS.map(({ key, icon: Icon, segment }) => {
        const href = `/${lang}/dashboard/settings/${segment}`
        const active = pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="h-4 w-4" />
            {navT[key]}
          </Link>
        )
      })}
    </nav>
  )
}
