'use client'

import { useState, useTransition } from 'react'
import { Wifi, WifiOff, RefreshCw, Unlink, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { disconnectDevice, syncDevice } from '@/actions/wearables'
import type { DeviceStatus } from '@/actions/wearables'
import type { Provider } from '@/services/wearables/types'

// ── Provider metadata (non-translatable technical info) ────────────────────────

interface ProviderMeta {
  logo: string
  connectHref: string
  supportsSync: boolean
  supportsPush: boolean
}

const PROVIDER_META: Record<Provider, ProviderMeta> = {
  garmin: {
    logo: '⌚',
    connectHref: '/api/auth/garmin/authorize',
    supportsSync: false,
    supportsPush: true,
  },
  wahoo: {
    logo: '🚴',
    connectHref: '/api/auth/wahoo/authorize',
    supportsSync: true,
    supportsPush: true,
  },
  coros: {
    logo: '🏃',
    connectHref: '/api/auth/coros/authorize',
    supportsSync: true,
    supportsPush: false,
  },
}

// ── Relative time helper ───────────────────────────────────────────────────────

interface TimeT {
  never: string
  justNow: string
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
}

function relativeTime(iso: string | null, t: TimeT): string {
  if (!iso) return t.never
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 2) return t.justNow
  if (mins < 60) return t.minutesAgo.replace('{n}', String(mins))
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t.hoursAgo.replace('{n}', String(hrs))
  const days = Math.floor(hrs / 24)
  return t.daysAgo.replace('{n}', String(days))
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DevicesT {
  providers: {
    garmin: string
    garminDesc: string
    wahoo: string
    wahooDesc: string
    coros: string
    corosDesc: string
  }
  connected: string
  notConnected: string
  lastSync: string
  never: string
  connect: string
  disconnect: string
  disconnecting: string
  syncNow: string
  syncing: string
  syncDone: string
  syncNone: string
  connectError: string
  disconnectError: string
  syncError: string
  garminNote: string
  corosNote: string
  id: string
  activitiesSynced: string
}

interface DeviceCardProps {
  status: DeviceStatus
  t: DevicesT
  timeT: TimeT
  onDisconnect: (provider: Provider) => Promise<void>
  onSync: (provider: Provider) => Promise<{ synced: number }>
}

// ── Device card ────────────────────────────────────────────────────────────────

function DeviceCard({ status, t, timeT, onDisconnect, onSync }: DeviceCardProps) {
  const meta = PROVIDER_META[status.provider]
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const providerName = t.providers[status.provider as keyof typeof t.providers] ?? status.provider
  const providerDesc = t.providers[`${status.provider}Desc` as keyof typeof t.providers] ?? ''
  const note =
    status.provider === 'garmin'
      ? t.garminNote
      : status.provider === 'coros'
        ? t.corosNote
        : undefined

  function handleDisconnect() {
    setLastResult(null)
    setActionError(null)
    startTransition(async () => {
      try {
        await onDisconnect(status.provider)
      } catch {
        setActionError(t.disconnectError)
      }
    })
  }

  function handleSync() {
    setLastResult(null)
    setActionError(null)
    startTransition(async () => {
      try {
        const result = await onSync(status.provider)
        setLastResult(
          result.synced > 0 ? t.syncDone.replace('{n}', String(result.synced)) : t.syncNone
        )
      } catch {
        setActionError(t.syncError)
      }
    })
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-5 transition-shadow',
        status.connected ? 'border-gray-200 shadow-sm' : 'border-gray-100'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {meta.logo}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{providerName}</h3>
            <p className="text-sm text-gray-500">{providerDesc}</p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            status.connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          )}
        >
          {status.connected ? (
            <>
              <Wifi className="h-3 w-3" /> {t.connected}
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> {t.notConnected}
            </>
          )}
        </span>
      </div>

      {/* Last sync */}
      {status.connected && (
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>
            {t.lastSync}: {relativeTime(status.lastSyncAt, timeT)}
          </span>
          {status.providerUserId && (
            <span>
              {t.id}: {status.providerUserId}
            </span>
          )}
        </div>
      )}

      {/* Provider note */}
      {note && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">{note}</p>}

      {/* Action feedback */}
      {lastResult && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {lastResult}
        </div>
      )}
      {actionError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {actionError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!status.connected ? (
          <a
            href={meta.connectHref}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Wifi className="h-4 w-4" />
            {t.connect}
          </a>
        ) : (
          <>
            {meta.supportsSync && (
              <button
                onClick={handleSync}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
                {isPending ? t.syncing : t.syncNow}
              </button>
            )}

            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Unlink className="h-4 w-4" />
              {isPending ? t.disconnecting : t.disconnect}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────────

interface DevicesPanelProps {
  initialStatuses: DeviceStatus[]
  lang: string
  t: DevicesT
  timeT: TimeT
}

export function DevicesPanel({ initialStatuses, t, timeT }: DevicesPanelProps) {
  const [statuses, setStatuses] = useState(initialStatuses)

  async function handleDisconnect(provider: Provider) {
    const result = await disconnectDevice(provider)
    if (result.ok) {
      setStatuses((prev) =>
        prev.map((s) =>
          s.provider === provider ? { ...s, connected: false, lastSyncAt: null } : s
        )
      )
    } else {
      throw new Error('disconnect failed')
    }
  }

  async function handleSync(provider: Provider): Promise<{ synced: number }> {
    const result = await syncDevice(provider)
    if (!result.ok) throw new Error('sync failed')
    setStatuses((prev) =>
      prev.map((s) =>
        s.provider === provider ? { ...s, lastSyncAt: new Date().toISOString() } : s
      )
    )
    return { synced: result.synced }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {statuses.map((status) => (
        <DeviceCard
          key={status.provider}
          status={status}
          t={t}
          timeT={timeT}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
        />
      ))}
    </div>
  )
}
