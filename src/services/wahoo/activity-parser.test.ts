import { describe, it, expect } from 'vitest'
import {
  mapWahooSportType,
  parseWahooWorkout,
  parseWahooWorkoutsResponse,
  type WahooWorkout,
} from './activity-parser'

// ── mapWahooSportType ──────────────────────────────────────────────────────────

describe('mapWahooSportType', () => {
  it.each([
    [1, 'bike'],
    [2, 'bike'],
    [3, 'run'],
    [4, 'run'],
    [5, 'swim'],
    [6, 'swim'],
    [7, 'strength'],
    [9, 'recovery'],
    [11, 'bike'],
    [12, 'run'],
    [14, 'brick'],
    [25, 'strength'],
    [26, 'recovery'],
  ] as [number, string][])('workout_type_id %d → %s', (id, expected) => {
    expect(mapWahooSportType(id)).toBe(expected)
  })

  it('falls back to "run" for unknown IDs', () => {
    expect(mapWahooSportType(9999)).toBe('run')
  })
})

// ── parseWahooWorkout ──────────────────────────────────────────────────────────

function base(overrides: Partial<WahooWorkout> = {}): WahooWorkout {
  return {
    id: 12345,
    workout_type_id: 3, // run
    starts: '2025-04-05T08:00:00Z',
    minutes: 60,
    ...overrides,
  }
}

describe('parseWahooWorkout', () => {
  it('maps basic fields', () => {
    const result = parseWahooWorkout(base(), 'user-1')
    expect(result.userId).toBe('user-1')
    expect(result.provider).toBe('wahoo')
    expect(result.providerActivityId).toBe('12345')
    expect(result.discipline).toBe('run')
    expect(result.durationMinutes).toBe(60)
    expect(result.date).toBe('2025-04-05')
    expect(result.data.durationSeconds).toBe(3600)
  })

  it('uses workout_summary duration when present', () => {
    const w = base({ workout_summary: { duration_active_accum: 3720 } })
    expect(parseWahooWorkout(w, 'u').data.durationSeconds).toBe(3720)
  })

  it('falls back to minutes*60 when no summary', () => {
    expect(parseWahooWorkout(base(), 'u').data.durationSeconds).toBe(3600)
  })

  it('includes HR fields from summary', () => {
    const w = base({ workout_summary: { hr_avg: 145, hr_max: 172 } })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgHr).toBe(145)
    expect(result.data.maxHr).toBe(172)
  })

  it('includes power fields when non-zero', () => {
    const w = base({
      workout_type_id: 1, // bike
      workout_summary: { power_avg: 220, power_bike_np_last: 235 },
    })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgPowerWatts).toBe(220)
    expect(result.data.normalizedPowerWatts).toBe(235)
  })

  it('omits power fields when zero', () => {
    const w = base({ workout_summary: { power_avg: 0, power_bike_np_last: 0 } })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgPowerWatts).toBeUndefined()
    expect(result.data.normalizedPowerWatts).toBeUndefined()
  })

  it('includes TSS, elevation, calories', () => {
    const w = base({
      workout_summary: { tss_last: 65, ascent_accum: 300, calories_accum: 600 },
    })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.tss).toBe(65)
    expect(result.data.elevationGainM).toBe(300)
    expect(result.data.calories).toBe(600)
  })

  it('derives sec/km pace for run', () => {
    // 10km in 3600s → 360 sec/km
    const w = base({
      workout_type_id: 3,
      workout_summary: { distance_accum: 10000, duration_active_accum: 3600 },
    })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgPaceSecPerKm).toBe(360)
    expect(result.data.avgPaceSecPer100m).toBeUndefined()
  })

  it('derives sec/100m pace for swim', () => {
    // 1000m in 1000s → 100 sec/100m
    const w = base({
      workout_type_id: 5,
      workout_summary: { distance_accum: 1000, duration_active_accum: 1000 },
    })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgPaceSecPer100m).toBe(100)
    expect(result.data.avgPaceSecPerKm).toBeUndefined()
  })

  it('does not derive pace for bike', () => {
    const w = base({
      workout_type_id: 1,
      workout_summary: { distance_accum: 40000, duration_active_accum: 3600 },
    })
    const result = parseWahooWorkout(w, 'u')
    expect(result.data.avgPaceSecPerKm).toBeUndefined()
    expect(result.data.avgPaceSecPer100m).toBeUndefined()
  })

  it('uses plan_date if starts is absent', () => {
    const w = base({
      starts: undefined,
      plan_date: '2025-04-10',
    } as Partial<WahooWorkout> as WahooWorkout)
    expect(parseWahooWorkout(w, 'u').date).toBe('2025-04-10')
  })
})

// ── parseWahooWorkoutsResponse ─────────────────────────────────────────────────

describe('parseWahooWorkoutsResponse', () => {
  it('returns empty array for empty response', () => {
    expect(parseWahooWorkoutsResponse({}, 'u')).toEqual([])
    expect(parseWahooWorkoutsResponse({ workouts: { items: [] } }, 'u')).toEqual([])
  })

  it('parses multiple workouts', () => {
    const result = parseWahooWorkoutsResponse(
      {
        workouts: {
          items: [base({ id: 1, workout_type_id: 3 }), base({ id: 2, workout_type_id: 1 })],
        },
      },
      'u'
    )
    expect(result).toHaveLength(2)
    expect(result[0]!.discipline).toBe('run')
    expect(result[1]!.discipline).toBe('bike')
  })
})
