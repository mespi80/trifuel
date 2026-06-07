'use client'

import { useCallback } from 'react'
import { addFoodLog } from '@/actions/nutrition'
import { enqueueLog } from '@/lib/offline-queue'
import type { MealSlot } from '@/actions/nutrition'

interface LogParams {
  foodItemId: string
  foodItemName: string
  mealSlot: MealSlot
  quantity: number
  date: string
}

export type LogResult =
  | { ok: true; offline: false; logId: string }
  | { ok: true; offline: true; queueId: string }
  | { ok: false }

/**
 * useOfflineLog — wraps addFoodLog with offline queuing.
 *
 * If the user is online:  calls the server action directly.
 * If the user is offline: saves to IndexedDB queue and returns immediately.
 * The OfflineBanner component syncs the queue automatically on reconnection.
 */
export function useOfflineLog() {
  const logFood = useCallback(async (params: LogParams): Promise<LogResult> => {
    if (navigator.onLine) {
      try {
        const result = await addFoodLog(
          params.foodItemId,
          params.mealSlot,
          params.quantity,
          params.date
        )
        if (!result.ok) return { ok: false }
        return { ok: true, offline: false, logId: result.logId ?? '' }
      } catch {
        // Network error despite navigator.onLine being true — fall through to queue
      }
    }

    // Offline path: save to IndexedDB queue
    try {
      const queueId = await enqueueLog({
        foodItemId: params.foodItemId,
        foodItemName: params.foodItemName,
        mealSlot: params.mealSlot,
        quantity: params.quantity,
        date: params.date,
      })
      return { ok: true, offline: true, queueId }
    } catch {
      return { ok: false }
    }
  }, [])

  return { logFood }
}
