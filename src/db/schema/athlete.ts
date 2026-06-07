import { pgTable, uuid, real, date, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sexEnum, dietTypeEnum, experienceLevelEnum } from './enums'
import { users } from './users'

export const athleteProfiles = pgTable('athlete_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),
  birthDate: date('birth_date'),
  sex: sexEnum('sex'),
  dietType: dietTypeEnum('diet_type').default('omnivore').notNull(),
  experienceLevel: experienceLevelEnum('experience_level').default('beginner').notNull(),
  // e.g. ["gluten", "nuts"]
  allergies: jsonb('allergies').$type<string[]>().default([]),
  // e.g. [{ id: "uuid", name: "Quinoa", category: "grain" }]
  preferredFoods: jsonb('preferred_foods')
    .$type<Array<{ id: string; name: string; category: string }>>()
    .default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const athleteProfilesRelations = relations(athleteProfiles, ({ one }) => ({
  user: one(users, {
    fields: [athleteProfiles.userId],
    references: [users.id],
  }),
}))

export type AthleteProfile = typeof athleteProfiles.$inferSelect
export type NewAthleteProfile = typeof athleteProfiles.$inferInsert
