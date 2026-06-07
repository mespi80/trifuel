import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { authProviderEnum, unitsEnum, languageEnum } from './enums'
import { athleteProfiles } from './athlete'
import { raceGoals, trainingPlans, trainingZones } from './training'
import { foodLogs, mealTemplates, nutritionTargets, hydrationLogs } from './nutrition'
import { bodyMeasurements } from './body'
import { wearableConnections } from './wearables'
import { subscriptions } from './subscriptions'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    name: text('name'),
    provider: authProviderEnum('provider').default('email').notNull(),
    providerId: text('provider_id'),
    language: languageEnum('language').default('en').notNull(),
    units: unitsEnum('units').default('metric').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    index('users_provider_provider_id_idx').on(t.provider, t.providerId),
  ]
)

export const usersRelations = relations(users, ({ one, many }) => ({
  athleteProfile: one(athleteProfiles, {
    fields: [users.id],
    references: [athleteProfiles.userId],
  }),
  raceGoals: many(raceGoals),
  trainingPlans: many(trainingPlans),
  trainingZones: many(trainingZones),
  foodLogs: many(foodLogs),
  mealTemplates: many(mealTemplates),
  nutritionTargets: many(nutritionTargets),
  hydrationLogs: many(hydrationLogs),
  bodyMeasurements: many(bodyMeasurements),
  wearableConnections: many(wearableConnections),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
