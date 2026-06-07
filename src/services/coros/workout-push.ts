/**
 * COROS workout push.
 *
 * The COROS Open Platform does not expose a public planned workout push API.
 * Workout scheduling is managed entirely within the COROS app and syncs to
 * the device via Bluetooth; there is no supported programmatic path.
 *
 * This module stubs the interface so the UI "Push to Device" flow can present
 * a helpful message to COROS users rather than crashing.
 */

import type { SessionToSerialize } from '@/services/wearables/types'

export async function pushWorkoutToCoros(
  _userId: string,
  _session: SessionToSerialize,
  _name: string
): Promise<string> {
  throw new Error(
    'COROS does not support pushing workouts via API. ' +
      'Please create the workout manually in the COROS app.'
  )
}
