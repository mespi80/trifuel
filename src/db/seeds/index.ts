import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../schema'
import { foodItemsData } from './food-items'

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  console.log('Seeding food_items...')

  const batchSize = 50
  for (let i = 0; i < foodItemsData.length; i += batchSize) {
    const batch = foodItemsData.slice(i, i + batchSize)
    await db.insert(schema.foodItems).values(batch).onConflictDoNothing()
    console.log(
      `  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(foodItemsData.length / batchSize)}`
    )
  }

  console.log(`Done. Seeded ${foodItemsData.length} food items.`)
  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
