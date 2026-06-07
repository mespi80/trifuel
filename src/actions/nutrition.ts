'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { foodItems, foodLogs } from '@/db/schema'
import { and, eq, desc, sql, ilike, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ── Shared types ──────────────────────────────────────────────────────────────

export type MealSlot =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'pre_workout'
  | 'intra_workout'
  | 'post_workout'

export type FoodItemData = {
  id: string
  nameEn: string
  nameEs: string | null
  brand: string | null
  servingSize: number
  servingUnit: string
  isVegan: boolean
  isVegetarian: boolean
  macros: {
    choG: number
    proteinG: number
    fatG: number
    fiberG: number
    sugarG: number
    calories: number
  }
  micros: {
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
  }
}

export type FoodLogRow = {
  id: string
  mealSlot: MealSlot
  quantity: number
  loggedAt: Date
  foodItem: FoodItemData
}

export type DailyNutritionLog = {
  date: string
  logs: FoodLogRow[]
  totals: {
    choG: number
    proteinG: number
    fatG: number
    calories: number
  }
  targets: {
    choG: number
    proteinG: number
    fatG: number
    calories: number
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100
}

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

// ── Get daily log ─────────────────────────────────────────────────────────────

export async function getDailyNutritionLog(date: string): Promise<DailyNutritionLog | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const rows = await db
    .select({
      log: foodLogs,
      item: foodItems,
    })
    .from(foodLogs)
    .innerJoin(foodItems, eq(foodLogs.foodItemId, foodItems.id))
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)))
    .orderBy(foodLogs.loggedAt)

  const logs: FoodLogRow[] = rows.map((r) => ({
    id: r.log.id,
    mealSlot: r.log.mealSlot as MealSlot,
    quantity: r.log.quantity,
    loggedAt: r.log.loggedAt,
    foodItem: {
      id: r.item.id,
      nameEn: r.item.nameEn,
      nameEs: r.item.nameEs ?? null,
      brand: r.item.brand ?? null,
      servingSize: r.item.servingSize,
      servingUnit: r.item.servingUnit,
      isVegan: r.item.isVegan,
      isVegetarian: r.item.isVegetarian,
      macros: r.item.macros as FoodItemData['macros'],
      micros: (r.item.micros ?? {}) as FoodItemData['micros'],
    },
  }))

  const totals = logs.reduce(
    (acc, log) => {
      const m = log.foodItem.macros
      const q = log.quantity
      return {
        choG: round2(acc.choG + m.choG * q),
        proteinG: round2(acc.proteinG + m.proteinG * q),
        fatG: round2(acc.fatG + m.fatG * q),
        calories: acc.calories + Math.round(m.calories * q),
      }
    },
    { choG: 0, proteinG: 0, fatG: 0, calories: 0 }
  )

  // Try to get today's nutrition target (stored after onboarding / AI generation)
  // For now return a reasonable default — targets come from the macro calculator
  const targets = null // TODO: query nutritionTargets table when populated

  return { date, logs, totals, targets }
}

// ── Add food log ──────────────────────────────────────────────────────────────

export async function addFoodLog(
  foodItemId: string,
  mealSlot: MealSlot,
  quantity: number,
  date: string
): Promise<{ ok: boolean; logId?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) return { ok: false }
  if (quantity <= 0) return { ok: false }

  const [inserted] = await db
    .insert(foodLogs)
    .values({ userId, foodItemId, mealSlot, quantity, date })
    .returning({ id: foodLogs.id })

  revalidatePath('/[lang]/dashboard/nutrition', 'page')
  return { ok: true, logId: inserted?.id }
}

// ── Remove food log ───────────────────────────────────────────────────────────

export async function removeFoodLog(logId: string): Promise<{ ok: boolean }> {
  const userId = await getCurrentUserId()
  if (!userId) return { ok: false }

  // Verify ownership via join
  const rows = await db
    .select({ id: foodLogs.id })
    .from(foodLogs)
    .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)))
    .limit(1)

  if (rows.length === 0) return { ok: false }

  await db.delete(foodLogs).where(eq(foodLogs.id, logId))
  revalidatePath('/[lang]/dashboard/nutrition', 'page')
  return { ok: true }
}

// ── Search food items ─────────────────────────────────────────────────────────

export async function searchFoodItems(query: string, limit = 20): Promise<FoodItemData[]> {
  if (!query.trim()) return []

  const rows = await db
    .select()
    .from(foodItems)
    .where(
      or(
        ilike(foodItems.nameEn, `%${query}%`),
        ilike(foodItems.nameEs, `%${query}%`),
        ilike(foodItems.brand, `%${query}%`)
      )
    )
    .limit(limit)

  return rows.map(toFoodItemData)
}

// ── Search by barcode ─────────────────────────────────────────────────────────

export async function searchFoodByBarcode(barcode: string): Promise<FoodItemData | null> {
  const rows = await db.select().from(foodItems).where(eq(foodItems.barcode, barcode)).limit(1)

  return rows.length > 0 ? toFoodItemData(rows[0]!) : null
}

// ── Get single food item ──────────────────────────────────────────────────────

export async function getFoodItemById(id: string): Promise<FoodItemData | null> {
  const rows = await db.select().from(foodItems).where(eq(foodItems.id, id)).limit(1)

  return rows.length > 0 ? toFoodItemData(rows[0]!) : null
}

// ── Recent foods ──────────────────────────────────────────────────────────────

export async function getRecentFoodItems(limit = 15): Promise<FoodItemData[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  // Distinct food items ordered by most recent log date
  const rows = await db
    .selectDistinctOn([foodLogs.foodItemId], {
      item: foodItems,
      loggedAt: foodLogs.loggedAt,
    })
    .from(foodLogs)
    .innerJoin(foodItems, eq(foodLogs.foodItemId, foodItems.id))
    .where(eq(foodLogs.userId, userId))
    .orderBy(foodLogs.foodItemId, desc(foodLogs.loggedAt))
    .limit(limit * 2) // overfetch since selectDistinctOn + orderBy can be tricky

  // Re-sort by loggedAt descending and deduplicate by id
  const seen = new Set<string>()
  return rows
    .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())
    .filter((r) => {
      if (seen.has(r.item.id)) return false
      seen.add(r.item.id)
      return true
    })
    .slice(0, limit)
    .map((r) => toFoodItemData(r.item))
}

// ── Frequent foods ────────────────────────────────────────────────────────────

export async function getFrequentFoodItems(limit = 15): Promise<FoodItemData[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const rows = await db
    .select({
      item: foodItems,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(foodLogs)
    .innerJoin(foodItems, eq(foodLogs.foodItemId, foodItems.id))
    .where(eq(foodLogs.userId, userId))
    .groupBy(foodItems.id)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)

  return rows.map((r) => toFoodItemData(r.item))
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toFoodItemData(item: typeof foodItems.$inferSelect): FoodItemData {
  return {
    id: item.id,
    nameEn: item.nameEn,
    nameEs: item.nameEs ?? null,
    brand: item.brand ?? null,
    servingSize: item.servingSize,
    servingUnit: item.servingUnit,
    isVegan: item.isVegan,
    isVegetarian: item.isVegetarian,
    macros: item.macros as FoodItemData['macros'],
    micros: (item.micros ?? {}) as FoodItemData['micros'],
  }
}
