import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { addFoodLog } from '@/actions/nutrition'
import type { MealSlot } from '@/actions/nutrition'

interface QueueEntry {
  id: string
  foodItemId: string
  mealSlot: string
  quantity: number
  date: string
}

/**
 * POST /api/offline/sync-food-logs
 *
 * Accepts an array of offline-queued food log entries and saves them
 * to the database. Returns per-entry success/failure so the client
 * can remove successfully synced entries from the IndexedDB queue.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  let entries: QueueEntry[]
  try {
    entries = (await req.json()) as QueueEntry[]
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const result = await addFoodLog(
          entry.foodItemId,
          entry.mealSlot as MealSlot,
          entry.quantity,
          entry.date
        )
        return { id: entry.id, ok: result.ok, logId: result.logId }
      } catch {
        return { id: entry.id, ok: false }
      }
    })
  )

  return NextResponse.json({ results })
}
