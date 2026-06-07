import { pgEnum } from 'drizzle-orm/pg-core'

export const providerEnum = pgEnum('provider', ['garmin', 'wahoo', 'coros'])
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple'])
export const unitsEnum = pgEnum('units', ['metric', 'imperial'])
export const languageEnum = pgEnum('language', ['en', 'es', 'pt'])
export const sexEnum = pgEnum('sex', ['male', 'female', 'other'])
export const dietTypeEnum = pgEnum('diet_type', ['vegan', 'vegetarian', 'omnivore'])
export const experienceLevelEnum = pgEnum('experience_level', [
  'beginner',
  'intermediate',
  'advanced',
  'elite',
])
export const raceDistanceEnum = pgEnum('race_distance', [
  'sprint',
  'olympic',
  'half_ironman',
  'ironman',
])
export const racePriorityEnum = pgEnum('race_priority', ['A', 'B', 'C'])
export const trainingPlanStatusEnum = pgEnum('training_plan_status', [
  'draft',
  'active',
  'completed',
  'cancelled',
])
export const disciplineEnum = pgEnum('discipline', [
  'swim',
  'bike',
  'run',
  'brick',
  'strength',
  'recovery',
])
export const intensityZoneEnum = pgEnum('intensity_zone', ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'])
export const sessionStatusEnum = pgEnum('session_status', [
  'planned',
  'completed',
  'missed',
  'skipped',
])
export const zoneTypeEnum = pgEnum('zone_type', ['hr', 'pace', 'power', 'css'])
export const foodSourceEnum = pgEnum('food_source', ['usda', 'openfoodfacts', 'user'])
export const mealSlotEnum = pgEnum('meal_slot', [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'pre_workout',
  'intra_workout',
  'post_workout',
])
export const hydrationTypeEnum = pgEnum('hydration_type', ['water', 'electrolyte', 'other'])
export const measurementSourceEnum = pgEnum('measurement_source', [
  'manual',
  'garmin',
  'wahoo',
  'coros',
  'scale',
])
export const wearableStatusEnum = pgEnum('wearable_status', [
  'active',
  'expired',
  'revoked',
  'error',
])
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'premium'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'cancelled',
  'incomplete',
])
