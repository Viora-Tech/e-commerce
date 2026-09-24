import { eq, sql } from 'drizzle-orm'
import { createDb, type Db } from './client'
import { store } from './schema'

/**
 * Grants the Waimers demo store the back-in-stock `unlimited` override: the
 * platform's own store sends its own alerts, outside the free quota. Written
 * once, idempotently (an existing settings row is merged, not replaced), and
 * only ever run against the store this deployment seeds for itself — never
 * against the shared dev DB's other stores. Plain SQL against the plugin's
 * own table (defined in `@commerce/plugin-back-in-stock/schema`) so this
 * package need not depend on that plugin just to seed one row.
 */
export async function seedWaimersBackInStock(db: Db, storeId: string): Promise<boolean> {
  const rows = await db.execute<{ unlimited: boolean }>(sql`
    insert into back_in_stock_settings (store_id, settings)
    values (${storeId}, '{"unlimited": true}'::jsonb)
    on conflict (store_id) do update
      set settings = back_in_stock_settings.settings || '{"unlimited": true}'::jsonb,
          updated_at = now()
    returning (settings->>'unlimited')::boolean as unlimited
  `)
  return rows[0]?.unlimited === true
}

export async function seedBackInStock(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const set = await seedWaimersBackInStock(db, s.id)
    console.log(
      set ? 'seed: back-in-stock set to unlimited' : 'seed: back-in-stock unlimited not set',
    )
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedBackInStock(url)
}
