import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRecentFoodItems } from '@/actions/nutrition'

/**
 * GET /api/offline/food-cache
 *
 * Returns the user's recently logged food items for offline caching.
 * The service worker uses StaleWhileRevalidate on this endpoint so
 * repeated food logging remains fast even without a connection.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { items: [], cachedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400' } }
    )
  }

  const items = await getRecentFoodItems(50).catch(() => [])

  return NextResponse.json(
    { items, cachedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400',
      },
    }
  )
}
