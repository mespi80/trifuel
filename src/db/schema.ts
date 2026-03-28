import { pgTable, text, timestamp, uuid, integer, real, jsonb, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'garmin' | 'wahoo' | 'coros'
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)]
)

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    provider: text('provider').notNull(),
    type: text('type').notNull(), // 'swim' | 'bike' | 'run' | 'brick' | 'other'
    name: text('name'),
    startTime: timestamp('start_time').notNull(),
    durationSeconds: integer('duration_seconds'),
    distanceMeters: real('distance_meters'),
    elevationGainMeters: real('elevation_gain_meters'),
    avgHeartRate: integer('avg_heart_rate'),
    maxHeartRate: integer('max_heart_rate'),
    avgPowerWatts: integer('avg_power_watts'),
    normalizedPowerWatts: integer('normalized_power_watts'),
    avgPaceSecPerKm: real('avg_pace_sec_per_km'),
    tss: real('tss'), // Training Stress Score
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('activities_user_id_idx').on(table.userId),
    index('activities_start_time_idx').on(table.startTime),
    index('activities_type_idx').on(table.type),
  ]
)

export const trainingLoad = pgTable(
  'training_load',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    atl: real('atl'), // Acute Training Load (fatigue)
    ctl: real('ctl'), // Chronic Training Load (fitness)
    tsb: real('tsb'), // Training Stress Balance (form)
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('training_load_user_id_idx').on(table.userId),
    index('training_load_date_idx').on(table.date),
  ]
)
