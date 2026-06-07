import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSessionsForRange } from '@/actions/training'

/**
 * GET /api/offline/today-workout
 *
 * Returns today's planned training sessions in a format suitable for
 * offline caching by the service worker (NetworkFirst, 1hr cache).
 * Safe to call unauthenticated — returns empty list.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { sessions: [], cachedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        },
      }
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  const sessions = await getSessionsForRange(today, today).catch(() => [])

  return NextResponse.json(
    { sessions, cachedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    }
  )
}
