/**
 * COROS activity parser.
 *
 * Normalizes COROS sport data objects (from GET /v2/coros/sport/list) into
 * the common `TrainingSessionActual` shape. Pure — no DB calls.
 */

import type { TrainingSessionActual, Discipline } from '@/services/wearables/types'

// ── COROS API types ────────────────────────────────────────────────────────────

export interface CorosSportData {
  labelId?: string | number // COROS activity label/ID
  sportType: number // sport mode (100 = run, 200 = bike, …)
  name?: string
  startTime: number // Unix timestamp (seconds)
  endTime?: number // Unix timestamp (seconds)
  totalTime?: number // duration in seconds
  distance?: number // metres
  avgHr?: number // bpm
  maxHr?: number // bpm
  avgPower?: number // watts
  normalizedPower?: number // watts (NP)
  calorie?: number
  totalUp?: number // elevation gain in metres
  avgPace?: number // sec/km (some firmware versions)
  avgSwimPace?: number // sec/100m
  trainingLoad?: number // COROS Training Load ≈ TSS
}

export interface CorosSportListResponse {
  result?: string // "0000" = success
  message?: string
  data?: {
    sportDataList?: CorosSportData[]
    count?: number
    totalPage?: number
    pageIndex?: number
  }
}

// ── Sport mode mapping ─────────────────────────────────────────────────────────

/**
 * COROS sportType → our Discipline.
 */
const COROS_SPORT_MAP: Record<number, Discipline> = {
  // Running
  100: 'run', // Outdoor Run
  101: 'run', // Trail Run
  102: 'run', // Track Run
  103: 'run', // Treadmill
  // Cycling
  200: 'bike', // Outdoor Cycling
  201: 'bike', // Indoor Cycling
  202: 'bike', // Mountain Biking
  203: 'bike', // Gravel / Road
  // Swimming
  300: 'swim', // Pool Swimming
  301: 'swim', // Open Water Swimming
  302: 'swim', // (alt code used in some firmware)
  // Multisport / Triathlon
  20: 'brick', // Triathlon
  21: 'brick', // Duathlon
  500: 'brick', // Multisport
  // Strength & conditioning
  9: 'strength', // Strength Training
  10: 'strength', // HIIT
  11: 'strength', // Gym
  901: 'strength', // Strength Training (alt)
  // Recovery / other
  1: 'recovery', // Walk
  2: 'recovery', // Hike
  3: 'recovery', // Yoga
  4: 'recovery', // Stretching
}

export function mapCorosSportType(sportType: number): Discipline {
  return COROS_SPORT_MAP[sportType] ?? 'run'
}

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parses a single COROS sport data entry into our common shape.
 */
export function parseCorosSportData(entry: CorosSportData, userId: string): TrainingSessionActual {
  const discipline = mapCorosSportType(entry.sportType)

  const startTimestamp = entry.startTime
  const date = new Date(startTimestamp * 1000).toISOString().slice(0, 10)

  // Duration: prefer totalTime, fall back to endTime - startTime
  const durationSeconds = entry.totalTime ?? (entry.endTime ? entry.endTime - entry.startTime : 0)
  const durationMinutes = Math.round(durationSeconds / 60)

  const data: TrainingSessionActual['data'] = { durationSeconds }

  if (entry.distance !== undefined && entry.distance > 0) data.distanceMeters = entry.distance
  if (entry.avgHr !== undefined && entry.avgHr > 0) data.avgHr = entry.avgHr
  if (entry.maxHr !== undefined && entry.maxHr > 0) data.maxHr = entry.maxHr
  if (entry.avgPower !== undefined && entry.avgPower > 0) data.avgPowerWatts = entry.avgPower
  if (entry.normalizedPower !== undefined && entry.normalizedPower > 0)
    data.normalizedPowerWatts = entry.normalizedPower
  if (entry.trainingLoad !== undefined && entry.trainingLoad > 0) data.tss = entry.trainingLoad
  if (entry.totalUp !== undefined && entry.totalUp > 0) data.elevationGainM = entry.totalUp
  if (entry.calorie !== undefined && entry.calorie > 0) data.calories = entry.calorie

  // Pace — COROS may provide it directly, otherwise derive from distance+duration
  if (discipline === 'run') {
    if (entry.avgPace && entry.avgPace > 0) {
      data.avgPaceSecPerKm = entry.avgPace
    } else if (data.distanceMeters && durationSeconds > 0) {
      const mps = data.distanceMeters / durationSeconds
      if (mps > 0) data.avgPaceSecPerKm = Math.round(1000 / mps)
    }
  }

  if (discipline === 'swim') {
    if (entry.avgSwimPace && entry.avgSwimPace > 0) {
      data.avgPaceSecPer100m = entry.avgSwimPace
    } else if (data.distanceMeters && durationSeconds > 0) {
      const mps = data.distanceMeters / durationSeconds
      if (mps > 0) data.avgPaceSecPer100m = Math.round(100 / mps)
    }
  }

  const labelId = entry.labelId !== undefined ? String(entry.labelId) : `coros-${startTimestamp}`

  return {
    userId,
    provider: 'coros',
    providerActivityId: labelId,
    activityName: entry.name,
    discipline,
    date,
    startTimestamp,
    durationMinutes,
    data,
  }
}

/**
 * Parses a COROS sport list API response.
 */
export function parseCorosSportListResponse(
  response: CorosSportListResponse,
  userId: string
): TrainingSessionActual[] {
  const entries = response.data?.sportDataList ?? []
  return entries.map((e) => parseCorosSportData(e, userId))
}
