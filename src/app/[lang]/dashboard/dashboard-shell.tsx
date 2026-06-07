'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Salad,
  Droplets,
  BarChart2,
  Settings,
  Activity,
} from 'lucide-react'
import type { Dictionary } from '@/lib/dictionaries'
import type { Locale } from '@/lib/dictionaries'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: React.ReactNode
  dict: Dictionary
  locale: Locale
  lang: string
}

export function DashboardShell({ children, dict, lang }: DashboardShellProps) {
  const pathname = usePathname()
  const t = dict.dashboard.nav

  const navItems = [
    { href: `/${lang}/dashboard`, label: t.home, icon: LayoutDashboard, exact: true },
    { href: `/${lang}/dashboard/training`, label: t.training, icon: CalendarDays },
    { href: `/${lang}/dashboard/nutrition`, label: t.nutrition, icon: Salad },
    { href: `/${lang}/dashboard/hydration`, label: t.hydration, icon: Droplets },
    { href: `/${lang}/dashboard/analytics`, label: t.analytics, icon: BarChart2 },
    { href: `/${lang}/dashboard/settings`, label: t.settings, icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden border-r border-gray-200 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-5">
          <Activity className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-bold tracking-tight">TriFuel</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav — scrollable to fit all 6 items */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto border-t border-gray-200 bg-white lg:hidden">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-w-[64px] flex-none flex-col items-center gap-1 px-3 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Main */}
      <main className="flex-1 pb-20 lg:pb-0 lg:pl-64">{children}</main>
    </div>
  )
}
