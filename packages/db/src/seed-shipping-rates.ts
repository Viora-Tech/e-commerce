import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { seedWaimersShipping } from './default-shipping'
import { store } from './schema'

export async function seedShippingRates(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const added = await seedWaimersShipping(db, s.id)
    console.log(
      added ? 'seed: added the All India shipping zone' : 'seed: shipping zones already present',
    )
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedShippingRates(url)
}
