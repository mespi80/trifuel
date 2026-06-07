'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getQueuedLogs, dequeueLog } from '@/lib/offline-queue'

// ── Online status hook ─────────────────────────────────────────────────────────

function useOnlineStatus() {
  // SSR-safe: initialise from navigator.onLine lazily (avoids hydration mismatch on SSR)
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}

// ── Offline sync ───────────────────────────────────────────────────────────────

async function syncQueue(): Promise<number> {
  const queued = await getQueuedLogs()
  if (queued.length === 0) return 0

  const res = await fetch('/api/offline/sync-food-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queued),
  })

  if (!res.ok) return 0

  const { results } = (await res.json()) as {
    results: Array<{ id: string; ok: boolean }>
  }

  let synced = 0
  for (const r of results) {
    if (r.ok) {
      await dequeueLog(r.id)
      synced++
    }
  }

  return synced
}

// ── Banner ─────────────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'done'

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [queueCount, setQueueCount] = useState(0)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncedCount, setSyncedCount] = useState(0)

  // Poll queue count every 5s so the count stays fresh
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const n = await getQueuedLogs().then((l) => l.length)
        if (!cancelled) setQueueCount(n)
      } catch {
        /* IndexedDB unavailable (SSR) */
      }
    }
    void refresh()
    const id = setInterval(refresh, 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // When coming back online, auto-sync the queue
  useEffect(() => {
    if (!online || queueCount === 0 || syncState !== 'idle') return

    const run = async () => {
      setSyncState('syncing')
      const n = await syncQueue()
      setSyncedCount(n)
      setSyncState('done')
      setQueueCount((prev) => Math.max(0, prev - n))
      setTimeout(() => setSyncState('idle'), 3_000)
    }
    void run().catch(() => setSyncState('idle'))
  }, [online, queueCount, syncState])

  // ── Render ───────────────────────────────────────────────────────────────────

  // "Synced" flash — shown briefly after coming back online
  if (syncState === 'done' && syncedCount > 0) {
    return (
      <div className="animate-in fade-in slide-in-from-top fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-xs font-medium text-white duration-300">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {syncedCount} food {syncedCount === 1 ? 'log' : 'logs'} synced successfully
      </div>
    )
  }

  // Offline state
  if (!online) {
    return (
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2',
          'bg-gray-900 px-4 py-2 text-xs font-medium text-white',
          'animate-in fade-in slide-in-from-top duration-300'
        )}
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-gray-300" />
        <span>
          You&apos;re offline — showing cached data.
          {queueCount > 0 && (
            <span className="ml-1 text-amber-300">
              {queueCount} food {queueCount === 1 ? 'log' : 'logs'} queued for sync.
            </span>
          )}
        </span>
      </div>
    )
  }

  // Syncing state
  if (syncState === 'syncing') {
    return (
      <div className="animate-in fade-in slide-in-from-top fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-xs font-medium text-white duration-300">
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        Syncing offline food logs…
      </div>
    )
  }

  return null
}
