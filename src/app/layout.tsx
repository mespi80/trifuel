import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SessionProviderWrapper } from '@/components/auth/session-provider'
import { OfflineBanner } from '@/components/offline-banner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Default metadata (en). Locale-specific pages can override via generateMetadata.
export const metadata: Metadata = {
  title: {
    default: 'TriFuel — AI-powered triathlon training & nutrition',
    template: '%s | TriFuel',
  },
  description: 'Personalized training plans and vegan nutrition for triathletes.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://trifuel.app'),
  alternates: {
    canonical: '/',
    languages: {
      en: '/en',
      es: '/es',
    },
  },
  applicationName: 'TriFuel',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TriFuel',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1A3A4A' },
    { media: '(prefers-color-scheme: dark)', color: '#1A3A4A' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang is overridden per-locale in [lang]/layout.tsx via <div lang={locale}>
    // Using "en" here as the baseline for the outer <html> element.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <OfflineBanner />
        <SessionProviderWrapper>
          {children}
          <Toaster />
        </SessionProviderWrapper>
        <noscript>
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            TriFuel requires JavaScript to run. Please enable it in your browser.
          </div>
        </noscript>
      </body>
    </html>
  )
}
