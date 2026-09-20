import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { inventoryLevel, product, store, storeDomain, variant } from './schema'

/** Dev seed: Waimers on localhost with one product. Idempotent on store slug. */
export async function seedDev(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl)
  try {
    const [existing] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (existing) {
      console.log('seed: waimers already present')
      return
    }
    const [s] = await db.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
    if (!s) throw new Error('store insert failed')
    await db.insert(storeDomain).values([
      { storeId: s.id, hostname: 'localhost', isPrimary: true },
      { storeId: s.id, hostname: 'waimers.localhost' },
    ])
    const [p] = await db
      .insert(product)
      .values({
        storeId: s.id,
        handle: 'ripple-wireless',
        title: 'Ripple Wireless',
        status: 'active',
      })
      .returning()
    if (!p) throw new Error('product insert failed')
    const rows = await db
      .insert(variant)
      .values([
        { storeId: s.id, productId: p.id, title: 'Black', pricePaise: 499900, mrpPaise: 599900 },
        { storeId: s.id, productId: p.id, title: 'White', pricePaise: 499900 },
      ])
      .returning()
    await db
      .insert(inventoryLevel)
      .values(rows.map((v, i) => ({ storeId: s.id, variantId: v.id, onHand: i === 0 ? 12 : 0 })))
    console.log(`seed: waimers created (${s.id})`)
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedDev(url)
}
