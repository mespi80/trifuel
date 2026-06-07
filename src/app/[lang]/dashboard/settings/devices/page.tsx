import { Cpu } from 'lucide-react'
import { getDictionary, isValidLocale } from '@/lib/dictionaries'
import { getConnectedDevices } from '@/actions/wearables'
import { DevicesPanel } from './devices-panel'
import { FeatureGate } from '@/components/premium/feature-gate'
import { FEATURES } from '@/lib/features'

interface PageProps {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function DevicesPage({ params, searchParams }: PageProps) {
  const { lang } = await params
  const sp = await searchParams
  const locale = isValidLocale(lang) ? lang : 'en'

  const [dict, statuses] = await Promise.all([getDictionary(locale), getConnectedDevices()])

  const t = dict.dashboard.settings.devices

  // Toast hints from OAuth callbacks
  const connectedProvider =
    sp['wahoo'] ?? sp['coros'] ?? (sp['garmin'] === 'connected' ? 'garmin' : null)
  const errorProvider = sp['error']

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <div className="rounded-lg bg-blue-50 p-2">
          <Cpu className="h-5 w-5 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
      </div>
      <p className="mb-8 ml-12 text-gray-500">{t.subtitle}</p>

      {/* OAuth callback toasts */}
      {connectedProvider === 'connected' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t.connectedSuccess}
        </div>
      )}
      {errorProvider && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t.connectError}
        </div>
      )}

      <FeatureGate feature={FEATURES.WEARABLE_AUTO_SYNC} lang={locale}>
        <DevicesPanel initialStatuses={statuses} lang={lang} t={t} timeT={dict.common.time} />
      </FeatureGate>
    </div>
  )
}
