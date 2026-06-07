import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  real,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { foodSourceEnum, mealSlotEnum, hydrationTypeEnum } from './enums'
import { users } from './users'
import { trainingSessions } from './training'

// ── Food Items ────────────────────────────────────────────────────────────────
export const foodItems = pgTable(
  'food_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameEn: text('name_en').notNull(),
    nameEs: text('name_es'),
    brand: text('brand'),
    barcode: text('barcode'),
    // { cho_g, protein_g, fat_g, fiber_g, sugar_g, calories } per serving
    macros: jsonb('macros')
      .$type<{
        choG: number
        proteinG: number
        fatG: number
        fiberG: number
        sugarG: number
        calories: number
      }>()
      .notNull(),
    // { b12_mcg, iron_mg, zinc_mg, omega3_ala_mg, omega3_epa_mg, omega3_dha_mg,
    //   calcium_mg, vitaminD_iu, leucine_mg, vitaminC_mg, vitaminA_iu,
    //   magnesium_mg, potassium_mg, folate_mcg, iodine_mcg }
    micros: jsonb('micros')
      .$type<{
        b12Mcg?: number
        ironMg?: number
        zincMg?: number
        omega3AlaMg?: number
        omega3EpaMg?: number
        omega3DhaMg?: number
        calciumMg?: number
        vitaminDIu?: number
        leucineMg?: number
        vitaminCMg?: number
        vitaminAIu?: number
        magnesiumMg?: number
        potassiumMg?: number
        folateMcg?: number
        iodineMcg?: number
      }>()
      .default({}),
    servingSize: real('serving_size').notNull(),
    servingUnit: text('serving_unit').notNull(), // 'g', 'ml', 'cup', 'tbsp', etc.
    isVegan: boolean('is_vegan').default(false).notNull(),
    isVegetarian: boolean('is_vegetarian').default(false).notNull(),
    isGlutenFree: boolean('is_gluten_free').default(false).notNull(),
    source: foodSourceEnum('source').default('user').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('food_items_name_en_idx').on(t.nameEn),
    index('food_items_barcode_idx').on(t.barcode),
    index('food_items_is_vegan_idx').on(t.isVegan),
    index('food_items_source_idx').on(t.source),
  ]
)

export const foodItemsRelations = relations(foodItems, ({ many }) => ({
  foodLogs: many(foodLogs),
}))

// ── Food Logs ─────────────────────────────────────────────────────────────────
export const foodLogs = pgTable(
  'food_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodItemId: uuid('food_item_id')
      .notNull()
      .references(() => foodItems.id, { onDelete: 'restrict' }),
    date: date('date').notNull(),
    mealSlot: mealSlotEnum('meal_slot').notNull(),
    quantity: real('quantity').notNull(), // multiplier of serving_size
    loggedAt: timestamp('logged_at').defaultNow().notNull(),
  },
  (t) => [
    index('food_logs_user_id_date_idx').on(t.userId, t.date),
    index('food_logs_user_id_idx').on(t.userId),
    index('food_logs_date_idx').on(t.date),
  ]
)

export const foodLogsRelations = relations(foodLogs, ({ one }) => ({
  user: one(users, { fields: [foodLogs.userId], references: [users.id] }),
  foodItem: one(foodItems, { fields: [foodLogs.foodItemId], references: [foodItems.id] }),
}))

// ── Meal Templates ────────────────────────────────────────────────────────────
export const mealTemplates = pgTable(
  'meal_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // [{ foodItemId, quantity, mealSlot }]
    items: jsonb('items')
      .$type<
        Array<{
          foodItemId: string
          quantity: number
          mealSlot: string
        }>
      >()
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('meal_templates_user_id_idx').on(t.userId)]
)

export const mealTemplatesRelations = relations(mealTemplates, ({ one }) => ({
  user: one(users, { fields: [mealTemplates.userId], references: [users.id] }),
}))

// ── Nutrition Targets ─────────────────────────────────────────────────────────
export const nutritionTargets = pgTable(
  'nutrition_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    choG: real('cho_g').notNull(),
    proteinG: real('protein_g').notNull(),
    fatG: real('fat_g').notNull(),
    calories: integer('calories').notNull(),
    hydrationMl: integer('hydration_ml').notNull(),
    micros: jsonb('micros')
      .$type<{
        b12Mcg?: number
        ironMg?: number
        zincMg?: number
        calciumMg?: number
        vitaminDIu?: number
        omega3Mg?: number
      }>()
      .default({}),
    generatedFromSessionId: uuid('generated_from_session_id').references(
      () => trainingSessions.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('nutrition_targets_user_date_idx').on(t.userId, t.date),
    index('nutrition_targets_user_id_idx').on(t.userId),
  ]
)

export const nutritionTargetsRelations = relations(nutritionTargets, ({ one }) => ({
  user: one(users, { fields: [nutritionTargets.userId], references: [users.id] }),
  generatedFromSession: one(trainingSessions, {
    fields: [nutritionTargets.generatedFromSessionId],
    references: [trainingSessions.id],
  }),
}))

// ── Hydration Logs ────────────────────────────────────────────────────────────
export const hydrationLogs = pgTable(
  'hydration_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    amountMl: integer('amount_ml').notNull(),
    type: hydrationTypeEnum('type').default('water').notNull(),
    loggedAt: timestamp('logged_at').defaultNow().notNull(),
  },
  (t) => [
    index('hydration_logs_user_id_date_idx').on(t.userId, t.date),
    index('hydration_logs_user_id_idx').on(t.userId),
  ]
)

export const hydrationLogsRelations = relations(hydrationLogs, ({ one }) => ({
  user: one(users, { fields: [hydrationLogs.userId], references: [users.id] }),
}))

// ── Types ─────────────────────────────────────────────────────────────────────
export type FoodItem = typeof foodItems.$inferSelect
export type NewFoodItem = typeof foodItems.$inferInsert
export type FoodLog = typeof foodLogs.$inferSelect
export type NewFoodLog = typeof foodLogs.$inferInsert
export type MealTemplate = typeof mealTemplates.$inferSelect
export type NewMealTemplate = typeof mealTemplates.$inferInsert
export type NutritionTarget = typeof nutritionTargets.$inferSelect
export type NewNutritionTarget = typeof nutritionTargets.$inferInsert
export type HydrationLog = typeof hydrationLogs.$inferSelect
export type NewHydrationLog = typeof hydrationLogs.$inferInsert
