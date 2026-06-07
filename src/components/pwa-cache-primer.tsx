'use client'

import { useEffect } from 'react'

/**
 * PwaCachePrimer — mounts invisibly in the dashboard layout and
 * pre-fetches the two offline-capable API endpoints so the
 * service worker caches them immediately after login.
 * Has no visible UI.
 */
export function PwaCachePrimer() {
  useEffect(() => {
    // Only prime when the SW is active and we're online
    if (!('serviceWorker' in navigator) || !navigator.onLine) return

    // Fire-and-forget; failures are silently ignored
    fetch('/api/offline/today-workout').catch(() => undefined)
    fetch('/api/offline/food-cache').catch(() => undefined)
  }, [])

  return null
}
