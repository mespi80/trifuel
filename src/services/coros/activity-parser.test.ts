import { describe, it, expect } from 'vitest'
import {
  mapCorosSportType,
  parseCorosSportData,
  parseCorosSportListResponse,
  type CorosSportData,
} from './activity-parser'

// ── mapCorosSportType ──────────────────────────────────────────────────────────

describe('mapCorosSportType', () => {
  it.each([
    [100, 'run'],
    [101, 'run'],
    [102, 'run'],
    [103, 'run'],
    [200, 'bike'],
    [201, 'bike'],
    [202, 'bike'],
    [300, 'swim'],
    [301, 'swim'],
    [302, 'swim'],
    [20, 'brick'],
    [500, 'brick'],
    [9, 'strength'],
    [901, 'strength'],
    [1, 'recovery'],
    [3, 'recovery'],
  ] as [number, string][])('sportType %d → %s', (type, expected) => {
    expect(mapCorosSportType(type)).toBe(expected)
  })

  it('falls back to "run" for unknown sport types', () => {
    expect(mapCorosSportType(9999)).toBe('run')
  })
})

// ── parseCorosSportData ────────────────────────────────────────────────────────

function base(overrides: Partial<CorosSportData> = {}): CorosSportData {
  return {
    sportType: 100, // run
    startTime: 1743849600, // 2025-04-05 08:00:00 UTC
    totalTime: 3600,
    labelId: 'act-001',
    ...overrides,
  }
}

describe('parseCorosSportData', () => {
  it('maps basic fields', () => {
    const result = parseCorosSportData(base(), 'user-1')
    expect(result.userId).toBe('user-1')
    expect(result.provider).toBe('coros')
    expect(result.providerActivityId).toBe('act-001')
    expect(result.discipline).toBe('run')
    expect(result.durationMinutes).toBe(60)
    expect(result.date).toBe('2025-04-05')
    expect(result.data.durationSeconds).toBe(3600)
  })

  it('derives duration from endTime - startTime when totalTime absent', () => {
    const entry = base({ totalTime: undefined, endTime: 1743849600 + 3600 })
    expect(parseCorosSportData(entry, 'u').data.durationSeconds).toBe(3600)
  })

  it('includes distance, HR, and elevation', () => {
    const entry = base({ distance: 10000, avgHr: 145, maxHr: 172, totalUp: 200 })
    const result = parseCorosSportData(entry, 'u')
    expect(result.data.distanceMeters).toBe(10000)
    expect(result.data.avgHr).toBe(145)
    expect(result.data.maxHr).toBe(172)
    expect(result.data.elevationGainM).toBe(200)
  })

  it('includes power fields when non-zero', () => {
    const entry = base({ sportType: 200, avgPower: 220, normalizedPower: 235 })
    const result = parseCorosSportData(entry, 'u')
    expect(result.data.avgPowerWatts).toBe(220)
    expect(result.data.normalizedPowerWatts).toBe(235)
  })

  it('omits power fields when zero', () => {
    const entry = base({ avgPower: 0, normalizedPower: 0 })
    const result = parseCorosSportData(entry, 'u')
    expect(result.data.avgPowerWatts).toBeUndefined()
    expect(result.data.normalizedPowerWatts).toBeUndefined()
  })

  it('uses direct avgPace for running when provided', () => {
    const entry = base({ sportType: 100, avgPace: 330 })
    expect(parseCorosSportData(entry, 'u').data.avgPaceSecPerKm).toBe(330)
  })

  it('derives sec/km pace for run from distance + duration', () => {
    // 10km in 3600s → 360 sec/km
    const entry = base({ sportType: 100, distance: 10000, totalTime: 3600 })
    expect(parseCorosSportData(entry, 'u').data.avgPaceSecPerKm).toBe(360)
  })

  it('uses direct avgSwimPace for swimming when provided', () => {
    const entry = base({ sportType: 300, avgSwimPace: 100 })
    expect(parseCorosSportData(entry, 'u').data.avgPaceSecPer100m).toBe(100)
  })

  it('derives sec/100m pace for swim from distance + duration', () => {
    // 2000m in 2000s → 100 sec/100m
    const entry = base({ sportType: 300, distance: 2000, totalTime: 2000 })
    expect(parseCorosSportData(entry, 'u').data.avgPaceSecPer100m).toBe(100)
  })

  it('does not add pace for cycling', () => {
    const entry = base({ sportType: 200, distance: 40000, totalTime: 3600 })
    const result = parseCorosSportData(entry, 'u')
    expect(result.data.avgPaceSecPerKm).toBeUndefined()
    expect(result.data.avgPaceSecPer100m).toBeUndefined()
  })

  it('includes training load as TSS', () => {
    const entry = base({ trainingLoad: 75 })
    expect(parseCorosSportData(entry, 'u').data.tss).toBe(75)
  })

  it('includes calories', () => {
    const entry = base({ calorie: 650 })
    expect(parseCorosSportData(entry, 'u').data.calories).toBe(650)
  })

  it('generates a fallback providerActivityId when labelId is absent', () => {
    const entry = base({ labelId: undefined })
    const result = parseCorosSportData(entry, 'u')
    expect(result.providerActivityId).toBe(`coros-${entry.startTime}`)
  })

  it('rounds durationMinutes correctly', () => {
    const entry = base({ totalTime: 3650 })
    expect(parseCorosSportData(entry, 'u').durationMinutes).toBe(61)
  })
})

// ── parseCorosSportListResponse ────────────────────────────────────────────────

describe('parseCorosSportListResponse', () => {
  it('returns empty array for empty/non-success response', () => {
    expect(parseCorosSportListResponse({}, 'u')).toEqual([])
    expect(
      parseCorosSportListResponse({ result: '0000', data: { sportDataList: [] } }, 'u')
    ).toEqual([])
  })

  it('parses multiple entries', () => {
    const result = parseCorosSportListResponse(
      {
        result: '0000',
        data: {
          sportDataList: [base({ sportType: 100 }), base({ sportType: 200 })],
        },
      },
      'u'
    )
    expect(result).toHaveLength(2)
    expect(result[0]!.discipline).toBe('run')
    expect(result[1]!.discipline).toBe('bike')
  })
})
