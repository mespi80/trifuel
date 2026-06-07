/**
 * Tests for Garmin activity webhook payload parser.
 */

import { describe, it, expect } from 'vitest'
import {
  mapGarminSportType,
  parseActivity,
  parseActivityWebhookPayload,
  type GarminActivitySummary,
} from './activity-parser'

// ── mapGarminSportType ─────────────────────────────────────────────────────────

describe('mapGarminSportType', () => {
  it.each([
    ['RUNNING', 'run'],
    ['TRAIL_RUNNING', 'run'],
    ['TREADMILL_RUNNING', 'run'],
    ['CYCLING', 'bike'],
    ['INDOOR_CYCLING', 'bike'],
    ['MOUNTAIN_BIKING', 'bike'],
    ['SWIMMING', 'swim'],
    ['OPEN_WATER_SWIMMING', 'swim'],
    ['POOL_SWIMMING', 'swim'],
    ['MULTI_SPORT', 'brick'],
    ['TRIATHLON', 'brick'],
    ['STRENGTH_TRAINING', 'strength'],
    ['HIIT', 'strength'],
    ['YOGA', 'recovery'],
    ['WALKING', 'recovery'],
  ] as [string, string][])('%s → %s', (input, expected) => {
    expect(mapGarminSportType(input)).toBe(expected)
  })

  it('falls back to "run" for unknown sport types', () => {
    expect(mapGarminSportType('UNKNOWN_SPORT')).toBe('run')
  })

  it('is case-insensitive', () => {
    expect(mapGarminSportType('running')).toBe('run')
    expect(mapGarminSportType('Cycling')).toBe('bike')
  })
})

// ── parseActivity ──────────────────────────────────────────────────────────────

function baseSummary(overrides: Partial<GarminActivitySummary> = {}): GarminActivitySummary {
  return {
    userId: 'garmin-user-1',
    summaryId: 'sum-001',
    activityType: 'RUNNING',
    startTimeInSeconds: 1743849600, // 2025-04-05 08:00 UTC
    startTimeOffsetInSeconds: 0,
    durationInSeconds: 3600,
    ...overrides,
  }
}

describe('parseActivity', () => {
  it('parses basic fields', () => {
    const result = parseActivity(baseSummary())
    expect(result.garminUserId).toBe('garmin-user-1')
    expect(result.garminSummaryId).toBe('sum-001')
    expect(result.discipline).toBe('run')
    expect(result.durationMinutes).toBe(60)
    expect(result.actualData.durationSeconds).toBe(3600)
  })

  it('derives local date using offset', () => {
    // UTC time is 23:00 but local is +02:00, so local date is next day
    const summary = baseSummary({
      startTimeInSeconds: 1743814800, // 2025-04-04 23:00 UTC
      startTimeOffsetInSeconds: 7200, // UTC+2
    })
    const result = parseActivity(summary)
    expect(result.date).toBe('2025-04-05')
  })

  it('uses UTC (offset=0) for date derivation', () => {
    const result = parseActivity(baseSummary())
    expect(result.date).toBe('2025-04-05')
  })

  it('includes distance when provided', () => {
    const result = parseActivity(baseSummary({ distanceInMeters: 10000 }))
    expect(result.actualData.distanceMeters).toBe(10000)
  })

  it('omits distance when not provided', () => {
    const result = parseActivity(baseSummary())
    expect(result.actualData.distanceMeters).toBeUndefined()
  })

  it('includes HR fields when provided', () => {
    const result = parseActivity(
      baseSummary({
        averageHeartRateInBeatsPerMinute: 145,
        maxHeartRateInBeatsPerMinute: 172,
      })
    )
    expect(result.actualData.avgHr).toBe(145)
    expect(result.actualData.maxHr).toBe(172)
  })

  it('includes power fields for cycling (>0 watts)', () => {
    const result = parseActivity(
      baseSummary({
        activityType: 'CYCLING',
        averagePowerInWatts: 220,
        normalizedPowerInWatts: 235,
      })
    )
    expect(result.actualData.avgPowerWatts).toBe(220)
    expect(result.actualData.normalizedPowerWatts).toBe(235)
  })

  it('omits power fields when 0', () => {
    const result = parseActivity(
      baseSummary({
        averagePowerInWatts: 0,
        normalizedPowerInWatts: 0,
      })
    )
    expect(result.actualData.avgPowerWatts).toBeUndefined()
    expect(result.actualData.normalizedPowerWatts).toBeUndefined()
  })

  it('calculates sec/km pace for running', () => {
    // 3 m/s = 1000/3 ≈ 333 sec/km
    const result = parseActivity(
      baseSummary({
        activityType: 'RUNNING',
        averageSpeedInMetersPerSecond: 3,
      })
    )
    expect(result.actualData.avgPaceSecPerKm).toBe(333)
    expect(result.actualData.avgPaceSecPer100m).toBeUndefined()
  })

  it('calculates sec/100m pace for swimming', () => {
    // 1 m/s = 100/1 = 100 sec/100m
    const result = parseActivity(
      baseSummary({
        activityType: 'SWIMMING',
        averageSpeedInMetersPerSecond: 1,
      })
    )
    expect(result.actualData.avgPaceSecPer100m).toBe(100)
    expect(result.actualData.avgPaceSecPerKm).toBeUndefined()
  })

  it('does not add pace for cycling', () => {
    const result = parseActivity(
      baseSummary({
        activityType: 'CYCLING',
        averageSpeedInMetersPerSecond: 10,
      })
    )
    expect(result.actualData.avgPaceSecPerKm).toBeUndefined()
    expect(result.actualData.avgPaceSecPer100m).toBeUndefined()
  })

  it('includes TSS when provided', () => {
    const result = parseActivity(baseSummary({ trainingStressScore: 75.5 }))
    expect(result.actualData.tss).toBe(75.5)
  })

  it('includes calories and elevation', () => {
    const result = parseActivity(
      baseSummary({
        calories: 650,
        totalElevationGainInMeters: 400,
      })
    )
    expect(result.actualData.calories).toBe(650)
    expect(result.actualData.elevationGainM).toBe(400)
  })

  it('rounds duration to nearest minute', () => {
    const result = parseActivity(baseSummary({ durationInSeconds: 3650 }))
    expect(result.durationMinutes).toBe(61)
  })
})

// ── parseActivityWebhookPayload ────────────────────────────────────────────────

describe('parseActivityWebhookPayload', () => {
  it('returns empty array for empty payload', () => {
    expect(parseActivityWebhookPayload({})).toEqual([])
    expect(parseActivityWebhookPayload({ activitySummaries: [] })).toEqual([])
  })

  it('parses multiple activities', () => {
    const result = parseActivityWebhookPayload({
      activitySummaries: [
        baseSummary({ summaryId: 'a1', activityType: 'RUNNING' }),
        baseSummary({ summaryId: 'a2', activityType: 'CYCLING' }),
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0]!.discipline).toBe('run')
    expect(result[1]!.discipline).toBe('bike')
  })
})
