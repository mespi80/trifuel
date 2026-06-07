/**
 * Session generator — produces individual training sessions for a given week.
 *
 * Given the macro parameters from the periodization engine (phase, target hours,
 * intensity distribution, discipline split, available days, time preference) it
 * outputs a day-by-day array of fully structured sessions including:
 *   • Discipline, duration, primary zone
 *   • Swim structure (warm-up / drill set / main set / cool-down)
 *   • Structured intervals for hard sessions (bike / run)
 *   • Brick sessions in build and peak phases
 *   • Bilingual objectives (EN / ES)
 *
 * Scheduling rules enforced:
 *   R1  Never two hard sessions back-to-back in the same discipline.
 *   R2  Longest ride placed on the weekend (Saturday first, then Sunday).
 *   R3  Swim sessions always have three-part structure.
 *   R4  Brick (bike→run) sessions only appear in build and peak phases.
 *   R5  Minimum 1 rest day per week; beginners always get a full rest day,
 *       advanced/elite may substitute active recovery.
 */

import type {
  PhaseLabel,
  ExperienceLevel,
  RaceDistance,
  ZoneDistribution,
  DisciplineSplit,
} from './types'

// ── Types ──────────────────────────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type ZoneKey = 'z1' | 'z2' | 'z3' | 'z4' | 'z5'
export type SessionDiscipline = 'swim' | 'bike' | 'run' | 'brick' | 'active_recovery' | 'rest'
export type TimePreference = 'morning' | 'lunch' | 'afternoon' | 'evening'

export interface BilingualText {
  en: string
  es: string
}

/** One part of a structured swim session. */
export interface SwimSet {
  type: 'warmup' | 'drill' | 'main' | 'cooldown'
  durationMinutes: number
  zone: ZoneKey
  description: BilingualText
}

/** A repeatable interval block within a hard bike or run session. */
export interface Interval {
  reps: number
  durationSeconds: number
  restSeconds: number
  zone: ZoneKey
  description: BilingualText
}

export interface GeneratedSession {
  day: DayKey
  /** Day index 0 (Mon) – 6 (Sun). */
  dayIndex: number
  discipline: SessionDiscipline
  durationMinutes: number
  primaryZone: ZoneKey
  /** True when the session contains Z4/Z5 work. */
  isHardSession: boolean
  /** True for bike→run combo sessions. */
  isBrick: boolean
  /** Present for swim sessions only. */
  swimStructure?: SwimSet[]
  /** Present for hard bike/run sessions. */
  intervals?: Interval[]
  objective: BilingualText
}

// ── Input ──────────────────────────────────────────────────────────────────────

export interface WeekSessionInput {
  phase: PhaseLabel
  targetHours: number
  intensityDistribution: ZoneDistribution
  disciplineSplit: DisciplineSplit
  availableDays: DayKey[]
  timePreference?: TimePreference
  experienceLevel: ExperienceLevel
  raceDistance: RaceDistance
  isRecoveryWeek?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAY_INDEX: Record<DayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
}
const WEEKEND: Set<DayKey> = new Set(['sat', 'sun'])

/** Minimum rest days per week by experience level. */
const MIN_REST_DAYS: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 1,
  advanced: 1,
  elite: 1,
}

/**
 * Whether a rest day for this level may be "active recovery" (Z1 movement)
 * rather than a complete day off.
 */
const ALLOWS_ACTIVE_RECOVERY: Record<ExperienceLevel, boolean> = {
  beginner: false,
  intermediate: false,
  advanced: true,
  elite: true,
}

/**
 * Fraction of total weekly hours that is "hard" (Z4+Z5), above which we
 * consider scheduling an extra hard session.
 */
const HARD_FRACTION_THRESHOLD = 0.15

// ── Typical session durations (minutes) ────────────────────────────────────────

const SWIM_DURATION: Record<PhaseLabel, number> = {
  base: 45,
  build: 55,
  peak: 60,
  taper: 40,
}
const BIKE_EASY_DURATION: Record<RaceDistance, number> = {
  sprint: 60,
  olympic: 75,
  half_ironman: 90,
  ironman: 120,
}
const BIKE_LONG_DURATION: Record<RaceDistance, number> = {
  sprint: 75,
  olympic: 100,
  half_ironman: 150,
  ironman: 210,
}
const RUN_EASY_DURATION: Record<RaceDistance, number> = {
  sprint: 30,
  olympic: 40,
  half_ironman: 50,
  ironman: 60,
}
const ACTIVE_RECOVERY_DURATION = 30

// ── Zone helpers ────────────────────────────────────────────────────────────────

function phaseHardZone(phase: PhaseLabel): ZoneKey {
  switch (phase) {
    case 'base':
      return 'z2'
    case 'build':
      return 'z4'
    case 'peak':
      return 'z4'
    case 'taper':
      return 'z4'
  }
}

// ── Interval templates ─────────────────────────────────────────────────────────

function buildBikeIntervals(phase: PhaseLabel, dist: RaceDistance): Interval[] {
  if (phase === 'build') {
    // Threshold intervals: 4–6 × 8 min @ Z4
    const reps = dist === 'ironman' || dist === 'half_ironman' ? 4 : 5
    return [
      {
        reps,
        durationSeconds: 480,
        restSeconds: 180,
        zone: 'z4',
        description: {
          en: `${reps} × 8 min at threshold power — steady effort, controlled breathing`,
          es: `${reps} × 8 min a potencia umbral — esfuerzo constante, respiración controlada`,
        },
      },
    ]
  }
  if (phase === 'peak') {
    // VO₂max short intervals: 6–8 × 3 min @ Z5
    const reps = dist === 'sprint' ? 6 : 5
    return [
      {
        reps,
        durationSeconds: 180,
        restSeconds: 180,
        zone: 'z5',
        description: {
          en: `${reps} × 3 min at VO₂max intensity — hard but sustainable`,
          es: `${reps} × 3 min a intensidad VO₂max — duro pero sostenible`,
        },
      },
      {
        reps: 1,
        durationSeconds: 300,
        restSeconds: 0,
        zone: 'z2',
        description: {
          en: '5 min easy spin cool-down',
          es: '5 min de rodaje suave de enfriamiento',
        },
      },
    ]
  }
  if (phase === 'taper') {
    return [
      {
        reps: 3,
        durationSeconds: 300,
        restSeconds: 180,
        zone: 'z4',
        description: {
          en: '3 × 5 min at race effort — maintain sharpness',
          es: '3 × 5 min al esfuerzo de carrera — mantener el ritmo',
        },
      },
    ]
  }
  return []
}

function buildRunIntervals(phase: PhaseLabel, dist: RaceDistance): Interval[] {
  if (phase === 'build') {
    // Tempo run: 3–4 × 10 min @ Z3
    const reps = dist === 'sprint' || dist === 'olympic' ? 3 : 4
    return [
      {
        reps,
        durationSeconds: 600,
        restSeconds: 120,
        zone: 'z3',
        description: {
          en: `${reps} × 10 min at tempo pace — comfortably hard`,
          es: `${reps} × 10 min a ritmo tempo — difícil pero controlado`,
        },
      },
    ]
  }
  if (phase === 'peak') {
    // Race-pace intervals: 5–8 × 3 min @ Z4–5
    const reps = dist === 'sprint' ? 6 : dist === 'olympic' ? 5 : 4
    return [
      {
        reps,
        durationSeconds: 180,
        restSeconds: 90,
        zone: 'z4',
        description: {
          en: `${reps} × 3 min at race pace — simulate race effort`,
          es: `${reps} × 3 min al ritmo de carrera — simular esfuerzo de competencia`,
        },
      },
    ]
  }
  if (phase === 'taper') {
    return [
      {
        reps: 4,
        durationSeconds: 120,
        restSeconds: 60,
        zone: 'z4',
        description: {
          en: '4 × 2 min at race pace strides — stay sharp',
          es: '4 × 2 min a zancadas de carrera — mantener la agudeza',
        },
      },
    ]
  }
  return []
}

// ── Swim structure builder ─────────────────────────────────────────────────────

function buildSwimStructure(phase: PhaseLabel, isHard: boolean, totalMinutes: number): SwimSet[] {
  const warmup = Math.round(totalMinutes * 0.2)
  const drill = Math.round(totalMinutes * 0.15)
  const cooldown = Math.round(totalMinutes * 0.1)
  const main = totalMinutes - warmup - drill - cooldown

  const sets: SwimSet[] = [
    {
      type: 'warmup',
      durationMinutes: warmup,
      zone: 'z1',
      description: {
        en: `${warmup} min easy warm-up — focus on stroke mechanics`,
        es: `${warmup} min de calentamiento suave — enfocarse en la mecánica de brazada`,
      },
    },
    {
      type: 'drill',
      durationMinutes: drill,
      zone: 'z1',
      description: {
        en: getDrillDescription(phase),
        es: getDrillDescriptionEs(phase),
      },
    },
    {
      type: 'main',
      durationMinutes: main,
      zone: isHard ? phaseHardZone(phase) : 'z2',
      description: {
        en: getSwimMainDescription(phase, isHard, main),
        es: getSwimMainDescriptionEs(phase, isHard, main),
      },
    },
    {
      type: 'cooldown',
      durationMinutes: cooldown,
      zone: 'z1',
      description: {
        en: `${cooldown} min easy cool-down — focus on breathing`,
        es: `${cooldown} min de enfriamiento suave — enfocarse en la respiración`,
      },
    },
  ]

  return sets
}

function getDrillDescription(phase: PhaseLabel): string {
  switch (phase) {
    case 'base':
      return 'Drill set: catch-up drill, fingertip drag, side kick — build proprioception'
    case 'build':
      return 'Drill set: fist drill, sculling, high-elbow catch — reinforce technique under fatigue'
    case 'peak':
      return 'Short drill set: 4 × 25 m catch drill — prime neuromuscular patterns'
    case 'taper':
      return 'Brief drill: 2 × 25 m catch-up — stay sharp, minimal fatigue'
  }
}
function getDrillDescriptionEs(phase: PhaseLabel): string {
  switch (phase) {
    case 'base':
      return 'Set de drills: catch-up, arrastre de dedos, patada lateral — construir propiocepción'
    case 'build':
      return 'Set de drills: drill con puño, sculling, agarre con codo alto — reforzar técnica bajo fatiga'
    case 'peak':
      return 'Set de drills corto: 4 × 25 m drill de agarre — activar patrones neuromusculares'
    case 'taper':
      return 'Drill breve: 2 × 25 m catch-up — mantenerse alerta, mínima fatiga'
  }
}

function getSwimMainDescription(phase: PhaseLabel, isHard: boolean, min: number): string {
  if (!isHard) {
    return `${min} min continuous aerobic swim — steady Z2 pace, even splits`
  }
  switch (phase) {
    case 'build':
      return `Main set: 6 × 100 m at CSS pace, 20 s rest — build sustainable speed`
    case 'peak':
      return `Main set: 8 × 50 m sprint + 4 × 200 m at CSS — race simulation`
    case 'taper':
      return `Main set: 4 × 100 m at CSS — maintain sharpness, full rest`
    default:
      return `${min} min aerobic swim — smooth and controlled`
  }
}
function getSwimMainDescriptionEs(phase: PhaseLabel, isHard: boolean, min: number): string {
  if (!isHard) {
    return `${min} min de natación aeróbica continua — ritmo Z2 constante, parciales iguales`
  }
  switch (phase) {
    case 'build':
      return `Serie principal: 6 × 100 m al ritmo CSS, 20 s descanso — construir velocidad sostenible`
    case 'peak':
      return `Serie principal: 8 × 50 m sprint + 4 × 200 m al CSS — simulación de carrera`
    case 'taper':
      return `Serie principal: 4 × 100 m al CSS — mantener agudeza, descanso completo`
    default:
      return `${min} min natación aeróbica — suave y controlada`
  }
}

// ── Objective text templates ───────────────────────────────────────────────────

function sessionObjective(
  discipline: SessionDiscipline,
  phase: PhaseLabel,
  isHard: boolean,
  isBrick: boolean,
  dist: RaceDistance
): BilingualText {
  if (discipline === 'rest') {
    return {
      en: 'Full rest day — allow adaptation and recovery',
      es: 'Día de descanso total — permitir adaptación y recuperación',
    }
  }
  if (discipline === 'active_recovery') {
    return {
      en: 'Active recovery — 30 min very easy movement, flush fatigue',
      es: 'Recuperación activa — 30 min de movimiento muy suave, eliminar fatiga',
    }
  }
  if (isBrick) {
    return {
      en: `Brick session: bike-to-run transition — practice switching disciplines, combat "jelly legs"`,
      es: `Sesión brick: transición bicicleta-carrera — practicar cambio de disciplina, combatir las "piernas de gelatina"`,
    }
  }

  const distName = {
    sprint: 'Sprint',
    olympic: 'Olympic',
    half_ironman: 'Half Ironman',
    ironman: 'Ironman',
  }[dist]

  if (discipline === 'swim') {
    if (!isHard)
      return {
        en: `${phase === 'base' ? 'Aerobic base swim' : 'Easy recovery swim'} — build stroke efficiency and aerobic capacity`,
        es: `${phase === 'base' ? 'Natación de base aeróbica' : 'Natación de recuperación suave'} — construir eficiencia de brazada y capacidad aeróbica`,
      }
    return {
      en: `${phase} swim quality session — develop ${phase === 'peak' ? 'race-pace' : 'threshold'} speed in the water`,
      es: `Sesión de calidad de natación (${phase}) — desarrollar velocidad ${phase === 'peak' ? 'de carrera' : 'umbral'} en el agua`,
    }
  }

  if (discipline === 'bike') {
    if (!isHard) {
      if (phase === 'base')
        return {
          en: `Long aerobic ride — ${distName} base building. Z2 throughout, steady power/HR`,
          es: `Rodaje aeróbico largo — construcción de base ${distName}. Z2 en todo momento, potencia/FC constante`,
        }
      return {
        en: 'Easy recovery ride — active flush, low power, high cadence',
        es: 'Rodaje de recuperación — descarga activa, baja potencia, cadencia alta',
      }
    }
    if (phase === 'build')
      return {
        en: 'Threshold bike session — sustained efforts to raise FTP and lactate tolerance',
        es: 'Sesión de bicicleta umbral — esfuerzos sostenidos para elevar FTP y tolerancia al lactato',
      }
    return {
      en: 'Race-intensity bike session — VO₂max intervals to sharpen peak power',
      es: 'Sesión de bicicleta a intensidad de carrera — intervalos de VO₂max para agudizar la potencia pico',
    }
  }

  // run
  if (!isHard) {
    if (phase === 'base')
      return {
        en: 'Easy aerobic run — conversational pace, build mileage and efficiency',
        es: 'Carrera aeróbica suave — ritmo de conversación, construir kilometraje y eficiencia',
      }
    return {
      en: 'Easy recovery run — very low intensity, shake out tired legs',
      es: 'Carrera de recuperación suave — muy baja intensidad, soltar las piernas cansadas',
    }
  }
  if (phase === 'build')
    return {
      en: 'Tempo run session — sustained threshold work to raise lactate threshold pace',
      es: 'Sesión de carrera tempo — trabajo umbral sostenido para elevar el ritmo de umbral de lactato',
    }
  return {
    en: `Race-pace run session — ${distName}-specific intervals at target race pace`,
    es: `Sesión de carrera a ritmo de competencia — intervalos específicos de ${distName} al ritmo objetivo`,
  }
}

// ── Session factory ────────────────────────────────────────────────────────────

function makeSession(
  day: DayKey,
  discipline: SessionDiscipline,
  durationMinutes: number,
  phase: PhaseLabel,
  isHard: boolean,
  raceDistance: RaceDistance,
  isBrick = false
): GeneratedSession {
  const primaryZone: ZoneKey = isHard ? phaseHardZone(phase) : phase === 'base' ? 'z2' : 'z1'

  const session: GeneratedSession = {
    day,
    dayIndex: DAY_INDEX[day],
    discipline,
    durationMinutes,
    primaryZone,
    isHardSession: isHard,
    isBrick,
    objective: sessionObjective(discipline, phase, isHard, isBrick, raceDistance),
  }

  if (discipline === 'swim') {
    session.swimStructure = buildSwimStructure(phase, isHard, durationMinutes)
  } else if ((discipline === 'bike' || discipline === 'run') && isHard) {
    session.intervals =
      discipline === 'bike'
        ? buildBikeIntervals(phase, raceDistance)
        : buildRunIntervals(phase, raceDistance)
  }

  return session
}

function makeRestSession(
  day: DayKey,
  experienceLevel: ExperienceLevel,
  phase: PhaseLabel,
  raceDistance: RaceDistance
): GeneratedSession {
  const isActive = ALLOWS_ACTIVE_RECOVERY[experienceLevel] && phase !== 'taper'
  const discipline: SessionDiscipline = isActive ? 'active_recovery' : 'rest'
  return makeSession(
    day,
    discipline,
    isActive ? ACTIVE_RECOVERY_DURATION : 0,
    phase,
    false,
    raceDistance
  )
}

// ── Core scheduling algorithm ──────────────────────────────────────────────────

interface SessionSlot {
  discipline: 'swim' | 'bike' | 'run'
  isHard: boolean
  isLongRide: boolean
  isBrick: boolean
}

/**
 * Decide what sessions to schedule based on weekly targets and phase.
 */
function planSessionSlots(input: WeekSessionInput): SessionSlot[] {
  const {
    phase,
    targetHours,
    disciplineSplit,
    intensityDistribution,
    experienceLevel,
    raceDistance,
    isRecoveryWeek,
  } = input

  const totalMinutes = targetHours * 60
  const swimMinutes = totalMinutes * disciplineSplit.swim
  const bikeMinutes = totalMinutes * disciplineSplit.bike
  const runMinutes = totalMinutes * disciplineSplit.run

  const avgSwimDur = SWIM_DURATION[phase]
  const avgBikeEasy = BIKE_EASY_DURATION[raceDistance]
  const avgRunEasy = RUN_EASY_DURATION[raceDistance]

  // Number of sessions per discipline
  const swimCount = Math.max(1, Math.round(swimMinutes / avgSwimDur))
  const bikeCount = Math.max(1, Math.round(bikeMinutes / Math.max(avgBikeEasy, 60)))
  const runCount = Math.max(1, Math.round(runMinutes / Math.max(avgRunEasy, 30)))

  const hardFraction = intensityDistribution.z4 + intensityDistribution.z5

  // Number of hard sessions per discipline (at most one hard session per type per week)
  const maxHardPerDiscipline = isRecoveryWeek ? 0 : 1
  const hasHardWork = hardFraction >= HARD_FRACTION_THRESHOLD
  const canHaveHardBike =
    hasHardWork && (phase === 'build' || phase === 'peak' || phase === 'taper')
  const canHaveHardRun = hasHardWork && (phase === 'build' || phase === 'peak' || phase === 'taper')
  const canHaveHardSwim = hasHardWork && (phase === 'build' || phase === 'peak')

  // Brick sessions: replace one bike + one run slot in build/peak for non-beginners
  const canBrick =
    (phase === 'build' || phase === 'peak') &&
    experienceLevel !== 'beginner' &&
    !isRecoveryWeek &&
    bikeCount >= 1 &&
    runCount >= 1

  const slots: SessionSlot[] = []

  // Swim sessions
  for (let i = 0; i < swimCount; i++) {
    slots.push({
      discipline: 'swim',
      isHard: i === 0 && canHaveHardSwim && maxHardPerDiscipline > 0,
      isLongRide: false,
      isBrick: false,
    })
  }

  // Bike sessions (first bike may be the long ride; one may be hard)
  let hardBikeAdded = false
  for (let i = 0; i < bikeCount; i++) {
    const isLong = i === 0 // first bike slot = long ride (to be placed on weekend)
    const isHard = !isLong && !hardBikeAdded && canHaveHardBike
    if (isHard) hardBikeAdded = true
    slots.push({ discipline: 'bike', isHard, isLongRide: isLong, isBrick: false })
  }

  // Run sessions (one may be hard; one may be part of a brick)
  let hardRunAdded = false
  let brickRunAdded = false
  for (let i = 0; i < runCount; i++) {
    const isBrick = canBrick && !brickRunAdded && i === runCount - 1
    if (isBrick) {
      brickRunAdded = true
    }
    const isHard = !isBrick && !hardRunAdded && canHaveHardRun
    if (isHard) hardRunAdded = true
    slots.push({ discipline: 'run', isHard, isLongRide: false, isBrick })
  }

  return slots
}

/**
 * Session duration for a specific slot.
 */
function slotDuration(slot: SessionSlot, phase: PhaseLabel, dist: RaceDistance): number {
  if (slot.isBrick) {
    // Brick = 75% of long bike + 20 min run
    return Math.round(BIKE_LONG_DURATION[dist] * 0.75) + 20
  }
  if (slot.discipline === 'swim') {
    return slot.isHard ? Math.round(SWIM_DURATION[phase] * 1.1) : SWIM_DURATION[phase]
  }
  if (slot.discipline === 'bike') {
    if (slot.isLongRide) return BIKE_LONG_DURATION[dist]
    return slot.isHard ? Math.round(BIKE_EASY_DURATION[dist] * 1.15) : BIKE_EASY_DURATION[dist]
  }
  // run
  const base = slot.isHard ? Math.round(RUN_EASY_DURATION[dist] * 1.2) : RUN_EASY_DURATION[dist]
  return base
}

/**
 * Assign session slots to available days, enforcing all scheduling rules.
 *
 * Strategy:
 *  1. Sort available days into weekday / weekend buckets.
 *  2. Place long ride first on a weekend day.
 *  3. Place hard sessions with ≥1 buffer day between same-discipline hard efforts.
 *  4. Place brick on a weekday (need recovery day after).
 *  5. Fill remaining slots with easy sessions.
 *  6. Assign remaining available days as rest / active recovery.
 */
function assignDays(
  slots: SessionSlot[],
  availableDays: DayKey[],
  minRestDays: number,
  phase: PhaseLabel,
  experienceLevel: ExperienceLevel,
  raceDistance: RaceDistance
): GeneratedSession[] {
  // Sort days in calendar order
  const sortedDays = [...availableDays].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
  const weekdays = sortedDays.filter((d) => !WEEKEND.has(d))
  const weekendDays = sortedDays.filter((d) => WEEKEND.has(d))

  // Ensure we don't schedule more sessions than available days minus required rest
  const maxSessions = Math.max(1, sortedDays.length - minRestDays)
  const cappedSlots = slots.slice(0, maxSessions)

  // Separate slot types
  const longRide = cappedSlots.find((s) => s.isLongRide)
  const brickSlots = cappedSlots.filter((s) => s.isBrick)
  const hardSlots = cappedSlots.filter((s) => s.isHard && !s.isBrick && !s.isLongRide)
  const easySlots = cappedSlots.filter((s) => !s.isHard && !s.isBrick && !s.isLongRide)

  const assigned = new Map<DayKey, SessionSlot>()

  // R2: long ride on first available weekend day
  if (longRide) {
    const weekendSlot = weekendDays[0] ?? sortedDays[sortedDays.length - 1]!
    assigned.set(weekendSlot, longRide)
  }

  // Helper: find the first free day that satisfies hard-session constraints
  function findDayForHard(
    slot: SessionSlot,
    candidates: DayKey[],
    skipUsed: boolean
  ): DayKey | undefined {
    for (const day of candidates) {
      if (assigned.has(day)) continue

      // R1: check no hard session of same discipline on adjacent days
      const idx = DAY_INDEX[day]
      const adjacentDays = sortedDays.filter((d) => Math.abs(DAY_INDEX[d] - idx) === 1)
      const adjacentConflict = adjacentDays.some((adj) => {
        const existing = assigned.get(adj)
        return existing && existing.discipline === slot.discipline && existing.isHard
      })
      if (!adjacentConflict) return day
    }
    // fallback — relax constraint if no valid day found
    return skipUsed ? undefined : candidates.find((d) => !assigned.has(d))
  }

  // Place hard sessions (prefer weekdays for non-long hard sessions)
  for (const slot of hardSlots) {
    const day =
      findDayForHard(slot, [...weekdays, ...weekendDays.filter((d) => !assigned.has(d))], true) ??
      sortedDays.find((d) => !assigned.has(d))
    if (day) assigned.set(day, slot)
  }

  // Place brick sessions (prefer mid-week)
  for (const slot of brickSlots) {
    const day = weekdays.find((d) => !assigned.has(d)) ?? sortedDays.find((d) => !assigned.has(d))
    if (day) assigned.set(day, slot)
  }

  // Place easy sessions in remaining slots
  for (const slot of easySlots) {
    const day = sortedDays.find((d) => !assigned.has(d))
    if (day) assigned.set(day, slot)
  }

  // Build GeneratedSession array
  const sessions: GeneratedSession[] = []

  for (const day of sortedDays) {
    const slot = assigned.get(day)
    if (slot) {
      const duration = slotDuration(slot, phase, raceDistance)
      if (slot.isBrick) {
        // Brick: single combined session representing bike→run
        sessions.push(makeSession(day, 'brick', duration, phase, true, raceDistance, true))
      } else {
        sessions.push(makeSession(day, slot.discipline, duration, phase, slot.isHard, raceDistance))
      }
    } else {
      // Rest or active recovery
      sessions.push(makeRestSession(day, experienceLevel, phase, raceDistance))
    }
  }

  // Add implied rest days for days NOT in availableDays (all 7 days context)
  // Not needed — we only return sessions for the available+rest within availableDays

  return sessions.sort((a, b) => a.dayIndex - b.dayIndex)
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Generate all training sessions for a single training week.
 *
 * @param input  Week parameters from the periodization engine.
 * @returns      Array of sessions, one per available day, sorted Mon–Sun.
 */
export function generateWeekSessions(input: WeekSessionInput): GeneratedSession[] {
  const { availableDays, experienceLevel, phase, raceDistance } = input

  if (availableDays.length === 0) return []

  const minRest = MIN_REST_DAYS[experienceLevel]
  const slots = planSessionSlots(input)

  return assignDays(slots, availableDays, minRest, phase, experienceLevel, raceDistance)
}

// ── Validation helpers (exported for use in tests and UI) ──────────────────────

/**
 * Assert that no two hard sessions of the same discipline appear on consecutive
 * days in a generated schedule.  Returns the first violation found, or null.
 */
export function findBackToBackHardViolation(
  sessions: GeneratedSession[]
): { dayA: DayKey; dayB: DayKey; discipline: SessionDiscipline } | null {
  const hard = sessions.filter(
    (s) => s.isHardSession && s.discipline !== 'rest' && s.discipline !== 'active_recovery'
  )
  hard.sort((a, b) => a.dayIndex - b.dayIndex)

  for (let i = 0; i < hard.length - 1; i++) {
    const a = hard[i]!
    const b = hard[i + 1]!
    if (b.dayIndex - a.dayIndex === 1 && a.discipline === b.discipline) {
      return { dayA: a.day, dayB: b.day, discipline: a.discipline }
    }
  }
  return null
}

/**
 * Return true if the swim session has all four required structural parts.
 */
export function swimHasFullStructure(session: GeneratedSession): boolean {
  if (session.discipline !== 'swim' || !session.swimStructure) return false
  const types = session.swimStructure.map((s) => s.type)
  return (
    types.includes('warmup') &&
    types.includes('drill') &&
    types.includes('main') &&
    types.includes('cooldown')
  )
}

/**
 * Return the rest / active_recovery sessions in a week.
 */
export function getRestDays(sessions: GeneratedSession[]): GeneratedSession[] {
  return sessions.filter((s) => s.discipline === 'rest' || s.discipline === 'active_recovery')
}

/**
 * Return true if the longest bike session falls on a weekend day.
 */
export function longestRideOnWeekend(sessions: GeneratedSession[]): boolean {
  const bikes = sessions.filter((s) => s.discipline === 'bike' || s.discipline === 'brick')
  if (bikes.length === 0) return true // vacuously true
  const longest = bikes.reduce((a, b) => (b.durationMinutes > a.durationMinutes ? b : a))
  return WEEKEND.has(longest.day)
}
