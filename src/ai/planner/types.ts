/**
 * Shared types for the periodization engine.
 */

// ── Enumerations ───────────────────────────────────────────────────────────────

export type RaceDistance = 'sprint' | 'olympic' | 'half_ironman' | 'ironman'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type PhaseLabel = 'base' | 'build' | 'peak' | 'taper'
export type IntensityModel = 'polarized' | 'pyramidal'

// ── Input ──────────────────────────────────────────────────────────────────────

/**
 * Optional per-discipline bias expressed as a 0–1 weight.
 * Values need not sum to 1; the engine normalises them.
 */
export interface DisciplinePreference {
  swim?: number
  bike?: number
  run?: number
}

export interface PlannerInput {
  /** Target race distance. */
  raceDistance: RaceDistance

  /**
   * Race date as an ISO-8601 string (e.g. "2025-06-15").
   * The engine calculates weeksAvailable from this + today when
   * weeksAvailable is omitted.
   */
  raceDate: string

  /**
   * Override the automatically-calculated weeks.
   * Useful in tests and when you want to plan for a fixed window.
   */
  weeksAvailable?: number

  /**
   * Target training load for a normal (non-taper) week, in hours.
   * The planner builds volume up to this value during the build phase.
   */
  weeklyHours: number

  experienceLevel: ExperienceLevel

  /**
   * Optional per-discipline weighting.  When omitted, race-distance defaults
   * are used (e.g. Ironman is more bike-heavy than Sprint).
   */
  disciplinePreferences?: DisciplinePreference

  /**
   * If true, the first week of each block uses a lower-volume "ramp"
   * instead of jumping straight to target.  Defaults to true.
   */
  useRampWeeks?: boolean
}

// ── Per-week output ────────────────────────────────────────────────────────────

/**
 * Zone intensity distribution expressed as fractions (0–1) summing to 1.
 *
 *   z1  Recovery
 *   z2  Aerobic
 *   z3  Tempo
 *   z4  Threshold
 *   z5  VO₂max / Speed
 */
export interface ZoneDistribution {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

/**
 * How training time is split across the three triathlon disciplines.
 * Values are fractions (0–1) and always sum to 1.
 */
export interface DisciplineSplit {
  swim: number
  bike: number
  run: number
}

export interface TrainingWeek {
  /** 1-based week number within the plan. */
  weekNumber: number

  /** Monday's date in ISO-8601 format for this training week. */
  startDate: string

  phase: PhaseLabel

  /** Target total training hours for the week. */
  targetHours: number

  /**
   * Intensity distribution — fraction of time in each HR/power zone.
   * Fractions sum to 1.
   */
  intensityDistribution: ZoneDistribution

  /**
   * Swim / bike / run time split.
   * Fractions sum to 1.
   */
  disciplineSplit: DisciplineSplit

  /**
   * Convenience fields — actual hours per discipline.
   * Derived from targetHours × disciplineSplit.
   */
  disciplineHours: {
    swim: number
    bike: number
    run: number
  }

  /**
   * True for the first week of a new phase (useful for UI highlighting).
   */
  isPhaseStart: boolean

  /**
   * True for "easy/recovery" micro-cycle weeks inserted every 3–4 weeks.
   * Volume is reduced ~20–25 % relative to the surrounding weeks.
   */
  isRecoveryWeek: boolean
}

// ── Plan-level output ──────────────────────────────────────────────────────────

export interface PhaseSummary {
  phase: PhaseLabel
  startWeek: number // 1-based
  endWeek: number // 1-based, inclusive
  durationWeeks: number
  avgHoursPerWeek: number
  /** Intensity model used within this phase. */
  intensityModel: IntensityModel
  focusDescription: string
}

export interface PeriodizationPlan {
  /** The original input used to generate this plan (for reproducibility). */
  input: PlannerInput

  /** Total weeks in the plan. */
  totalWeeks: number

  /** High-level phase summaries. */
  phases: PhaseSummary[]

  /** Week-by-week detail. */
  weeks: TrainingWeek[]

  /**
   * Intensity model applied — determined by experience level.
   * beginners: polarized (80/20); intermediate/advanced/elite: pyramidal.
   */
  intensityModel: IntensityModel

  /** Peak week (highest target hours) index within `weeks` (0-based). */
  peakWeekIndex: number

  /** ISO-8601 date the plan was generated. */
  generatedAt: string
}

// ── Phase allocation config ────────────────────────────────────────────────────

export interface PhaseConfig {
  /**
   * Proportion of total plan weeks for each phase.
   * Values should sum to 1.
   */
  baseRatio: number
  buildRatio: number
  peakRatio: number
  /** Taper is expressed in absolute weeks, not a ratio. */
  taperWeeks: number
  /** Minimum weeks for each variable-length phase. */
  minBaseWeeks: number
  minBuildWeeks: number
  minPeakWeeks: number
}
