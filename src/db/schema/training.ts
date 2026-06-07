import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
  smallint,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import {
  raceDistanceEnum,
  racePriorityEnum,
  trainingPlanStatusEnum,
  disciplineEnum,
  intensityZoneEnum,
  sessionStatusEnum,
  zoneTypeEnum,
} from './enums'
import { users } from './users'

// ── Race Goals ────────────────────────────────────────────────────────────────
export const raceGoals = pgTable(
  'race_goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    distance: raceDistanceEnum('distance').notNull(),
    raceName: text('race_name').notNull(),
    raceDate: date('race_date').notNull(),
    priority: racePriorityEnum('priority').default('A').notNull(),
    // e.g. { swim: "00:32:00", t1: "00:03:00", bike: "01:05:00", t2: "00:02:00", run: "00:48:00", total: "02:30:00" }
    targetTimes: jsonb('target_times').$type<Record<string, string>>().default({}),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('race_goals_user_id_idx').on(t.userId),
    index('race_goals_race_date_idx').on(t.raceDate),
  ]
)

export const raceGoalsRelations = relations(raceGoals, ({ one, many }) => ({
  user: one(users, { fields: [raceGoals.userId], references: [users.id] }),
  trainingPlans: many(trainingPlans),
}))

// ── Training Plans ────────────────────────────────────────────────────────────
export const trainingPlans = pgTable(
  'training_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    raceGoalId: uuid('race_goal_id').references(() => raceGoals.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    status: trainingPlanStatusEnum('status').default('draft').notNull(),
    weeklyHoursTarget: real('weekly_hours_target'),
    // Array of { phase: string, startDate: string, endDate: string, focusAreas: string[], weeklyHours: number }
    phases: jsonb('phases')
      .$type<
        Array<{
          phase: string
          startDate: string
          endDate: string
          focusAreas: string[]
          weeklyHours: number
        }>
      >()
      .default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('training_plans_user_id_idx').on(t.userId),
    index('training_plans_race_goal_id_idx').on(t.raceGoalId),
    index('training_plans_status_idx').on(t.status),
  ]
)

export const trainingPlansRelations = relations(trainingPlans, ({ one, many }) => ({
  user: one(users, { fields: [trainingPlans.userId], references: [users.id] }),
  raceGoal: one(raceGoals, { fields: [trainingPlans.raceGoalId], references: [raceGoals.id] }),
  sessions: many(trainingSessions),
}))

// ── Training Sessions ─────────────────────────────────────────────────────────
export const trainingSessions = pgTable(
  'training_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => trainingPlans.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    discipline: disciplineEnum('discipline').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    intensityZone: intensityZoneEnum('intensity_zone'),
    // e.g. [{ reps: 8, distance: 200, restSeconds: 30, targetPace: "3:30/100m" }]
    intervals: jsonb('intervals')
      .$type<
        Array<{
          reps: number
          distance?: number
          durationSeconds?: number
          restSeconds: number
          targetPace?: string
          targetPower?: number
          targetHr?: number
        }>
      >()
      .default([]),
    objective: text('objective'),
    status: sessionStatusEnum('status').default('planned').notNull(),
    // Actual recorded data from wearable/manual entry
    actualData: jsonb('actual_data').$type<{
      durationSeconds?: number
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
    }>(),
    rpe: smallint('rpe'), // 1-10 Rating of Perceived Exertion
    notes: text('notes'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('training_sessions_plan_id_idx').on(t.planId),
    index('training_sessions_date_idx').on(t.date),
    index('training_sessions_discipline_idx').on(t.discipline),
    index('training_sessions_status_idx').on(t.status),
  ]
)

export const trainingSessionsRelations = relations(trainingSessions, ({ one }) => ({
  plan: one(trainingPlans, { fields: [trainingSessions.planId], references: [trainingPlans.id] }),
}))

// ── Training Zones ────────────────────────────────────────────────────────────
export const trainingZones = pgTable(
  'training_zones',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    discipline: disciplineEnum('discipline').notNull(),
    zoneType: zoneTypeEnum('zone_type').notNull(),
    // e.g. { z1: { min: 100, max: 135 }, z2: { min: 136, max: 153 }, ... }
    zones: jsonb('zones')
      .$type<Record<string, { min: number; max: number; label?: string }>>()
      .notNull(),
    lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('training_zones_user_discipline_type_idx').on(t.userId, t.discipline, t.zoneType),
    index('training_zones_user_id_idx').on(t.userId),
  ]
)

export const trainingZonesRelations = relations(trainingZones, ({ one }) => ({
  user: one(users, { fields: [trainingZones.userId], references: [users.id] }),
}))

// ── Types ─────────────────────────────────────────────────────────────────────
export type RaceGoal = typeof raceGoals.$inferSelect
export type NewRaceGoal = typeof raceGoals.$inferInsert
export type TrainingPlan = typeof trainingPlans.$inferSelect
export type NewTrainingPlan = typeof trainingPlans.$inferInsert
export type TrainingSession = typeof trainingSessions.$inferSelect
export type NewTrainingSession = typeof trainingSessions.$inferInsert
export type TrainingZone = typeof trainingZones.$inferSelect
export type NewTrainingZone = typeof trainingZones.$inferInsert
