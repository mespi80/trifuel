import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { ExpirationPlugin, NetworkFirst, StaleWhileRevalidate, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// ── Custom caches ─────────────────────────────────────────────────────────────

const todayWorkoutCache = new NetworkFirst({
  cacheName: 'today-workout-v1',
  plugins: [
    new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 * 60 }), // 1 hour
  ],
  networkTimeoutSeconds: 5,
})

const foodCacheStrategy = new StaleWhileRevalidate({
  cacheName: 'food-cache-v1',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    }),
  ],
})

// ── Serwist instance ──────────────────────────────────────────────────────────

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Today's planned workout — NetworkFirst with 5s timeout so offline shows cached
    {
      matcher: ({ url }) => url.pathname === '/api/offline/today-workout',
      handler: todayWorkoutCache,
    },
    // Food favorites + recents — StaleWhileRevalidate (serve instantly, update in bg)
    {
      matcher: ({ url }) => url.pathname === '/api/offline/food-cache',
      handler: foodCacheStrategy,
    },
    // All other Next.js defaults (static assets, fonts, pages via NetworkFirst)
    ...defaultCache,
  ],
})

serwist.addEventListeners()
