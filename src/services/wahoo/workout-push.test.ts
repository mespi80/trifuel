import { describe, it, expect } from 'vitest'
import { serializeWahooWorkout } from './workout-push'
import type { SessionToSerialize } from '@/services/wearables/types'

function base(overrides: Partial<SessionToSerialize> = {}): SessionToSerialize {
  return {
    discipline: 'run',
    durationMinutes: 45,
    objective: 'Easy run',
    ...overrides,
  }
}

describe('serializeWahooWorkout', () => {
  it('sets correct workout_type_id for each discipline', () => {
    const disciplines: [SessionToSerialize['discipline'], number][] = [
      ['bike', 1],
      ['run', 3],
      ['swim', 5],
      ['brick', 14],
      ['strength', 7],
      ['recovery', 9],
    ]
    for (const [discipline, expectedId] of disciplines) {
      const w = serializeWahooWorkout(base({ discipline }), 'Test', '2025-04-05')
      expect(w.workout_type_id).toBe(expectedId)
    }
  })

  it('sets name and plan_date', () => {
    const w = serializeWahooWorkout(base(), 'Morning Run', '2025-04-05')
    expect(w.name).toBe('Morning Run')
    expect(w.plan_date).toBe('2025-04-05')
  })

  it('sets minutes from durationMinutes', () => {
    const w = serializeWahooWorkout(base({ durationMinutes: 75 }), 'Long Run', '2025-04-05')
    expect(w.minutes).toBe(75)
  })

  it('sets workout_summary.duration_active_accum as minutes * 60', () => {
    const w = serializeWahooWorkout(base({ durationMinutes: 60 }), 'Run', '2025-04-05')
    expect(w.workout_summary?.duration_active_accum).toBe(3600)
  })
})
