/**
 * Shared wearable provider types.
 *
 * All provider-specific activity parsers normalize their output to
 * `TrainingSessionActual`, which maps 1-to-1 with the `actualData` field
 * on `trainingSessions` plus the metadata needed to match/upsert a session.
 */

// ── Common discipline / zone enums ─────────────────────────────────────────────

export type Discipline = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'recovery'
export type Provider = 'garmin' | 'wahoo' | 'coros'

// ── Normalized activity shape ──────────────────────────────────────────────────

/**
 * Provider-agnostic activity returned by every parser.
 * Callers match this against a planned `TrainingSession` by date + discipline.
 */
export interface TrainingSessionActual {
  /** Internal user ID — resolved by the caller, not the parser */
  userId: string
  provider: Provider
  /** Provider's own activity/workout ID (string for cross-provider consistency) */
  providerActivityId: string
  activityName?: string
  discipline: Discipline
  /** Local date string "YYYY-MM-DD" */
  date: string
  /** Unix timestamp (seconds) of activity start */
  startTimestamp: number
  durationMinutes: number
  data: {
    durationSeconds: number
    distanceMeters?: number
    avgHr?: number
    maxHr?: number
    avgPowerWatts?: number
    normalizedPowerWatts?: number
    avgPaceSecPer100m?: number
    avgPaceSecPerKm?: number
    tss?: number
    elevationGainM?: number
    calories?: number
  }
}

// ── Session input for workout push ─────────────────────────────────────────────

export interface WorkoutInterval {
  reps?: number
  distance?: number // metres
  durationSeconds?: number
  restSeconds?: number
  targetPace?: string // "M:SS/km" or "M:SS/100m"
  targetPower?: number // watts
  targetHr?: number // bpm
}

export interface SessionToSerialize {
  discipline: Discipline
  durationMinutes: number
  intensityZone?: string // "z1"–"z6"
  objective?: string
  intervals?: WorkoutInterval[]
}

// ── Standard provider interface ────────────────────────────────────────────────

/**
 * Interface every wearable integration must satisfy.
 * OAuth routes call `authorize()` and `handleCallback()`.
 * Sync jobs call `syncActivities()`.
 * The "Push to Device" button calls `pushWorkout()`.
 */
export interface WearableProvider {
  /**
   * Builds the provider authorization URL and stores the OAuth state.
   * Returns a redirect Response to the provider's auth page.
   */
  authorize(userId: string, request: Request): Promise<Response>

  /**
   * Handles the OAuth callback, exchanges code for tokens, persists them.
   * Returns a redirect Response to the post-connect destination.
   */
  handleCallback(request: Request): Promise<Response>

  /**
   * Fetches activities from the provider API since `since` (defaults to last 30 days).
   * Returns normalized activities; does NOT write to DB — caller decides what to upsert.
   */
  syncActivities(userId: string, since?: Date): Promise<TrainingSessionActual[]>

  /**
   * Pushes a planned workout to the provider (so it appears on the user's device).
   * Returns the provider's workout ID.
   */
  pushWorkout(userId: string, session: SessionToSerialize, name: string): Promise<string>
}
