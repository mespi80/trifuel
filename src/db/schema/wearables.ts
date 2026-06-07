import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  real,
  smallint,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { providerEnum, wearableStatusEnum } from './enums'
import { users } from './users'

export const wearableConnections = pgTable(
  'wearable_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: providerEnum('provider').notNull(),
    /** The provider's own user/athlete identifier (e.g. Garmin userId) */
    providerUserId: text('provider_user_id'),
    // Stored encrypted (AES-256-GCM); decrypt in service layer only.
    // For OAuth 1.0a (Garmin): accessToken → accessTokenEncrypted,
    //                           tokenSecret → refreshTokenEncrypted
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt: timestamp('token_expires_at'),
    lastSyncAt: timestamp('last_sync_at'),
    status: wearableStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('wearable_connections_user_provider_idx').on(t.userId, t.provider),
    index('wearable_connections_user_id_idx').on(t.userId),
    index('wearable_connections_status_idx').on(t.status),
  ]
)

export const wearableConnectionsRelations = relations(wearableConnections, ({ one, many }) => ({
  user: one(users, { fields: [wearableConnections.userId], references: [users.id] }),
  hrvReadings: many(garminHrvReadings),
}))

// ── Garmin HRV Time Series ─────────────────────────────────────────────────────
// One row per day per user; stores the previous-night HRV summary from
// Garmin's /wellness-api/rest/dailies endpoint.
export const garminHrvReadings = pgTable(
  'garmin_hrv_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Calendar date of the *night* measured (e.g. 2026-04-07 = night of Apr 6→7) */
    date: date('date').notNull(),
    /** Weekly average HRV in milliseconds */
    weeklyAvgMs: real('weekly_avg_ms'),
    /** 5-min HRV high value during the night */
    lastNightHighMs: real('last_night_high_ms'),
    /** 5-min HRV low value during the night */
    lastNightLowMs: real('last_night_low_ms'),
    /** Garmin HRV status string: "BALANCED" | "UNBALANCED" | "LOW" | "POOR" */
    status: text('status'),
    /** Baseline HRV for this user (rolling 25-day average from Garmin) */
    baselineMs: real('baseline_ms'),
    /** Stress level score 0–100 if available from the dailies payload */
    avgStressLevel: smallint('avg_stress_level'),
    /** Full raw HRV payload for auditability / future fields */
    rawPayload: jsonb('raw_payload'),
    pulledAt: timestamp('pulled_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('garmin_hrv_readings_user_date_idx').on(t.userId, t.date),
    index('garmin_hrv_readings_user_id_idx').on(t.userId),
  ]
)

export const garminHrvReadingsRelations = relations(garminHrvReadings, ({ one }) => ({
  user: one(users, { fields: [garminHrvReadings.userId], references: [users.id] }),
}))

export type WearableConnection = typeof wearableConnections.$inferSelect
export type NewWearableConnection = typeof wearableConnections.$inferInsert
export type GarminHrvReading = typeof garminHrvReadings.$inferSelect
export type NewGarminHrvReading = typeof garminHrvReadings.$inferInsert
