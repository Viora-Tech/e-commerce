import { sql } from 'drizzle-orm'
import type { Db } from './client'

export type StoreTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Run `fn` inside a transaction scoped to one store. RLS policies read
 * `app.store_id`, so every query in `fn` sees only that store's rows. `catalogId` also sets
 * `app.catalog_id` (the storefront's market sells from that catalog only: Markets › Catalogs),
 * in the same statement.
 */
export async function withStore<T>(
  db: Db,
  storeId: string,
  fn: (tx: StoreTx) => Promise<T>,
  options: { catalogId?: string | null | undefined } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      options.catalogId
        ? sql`select set_config('app.store_id', ${storeId}, true), set_config('app.catalog_id', ${options.catalogId}, true)`
        : sql`select set_config('app.store_id', ${storeId}, true)`,
    )
    return fn(tx)
  })
}

/**
 * Deliberately unscoped transaction. Only meaningful on an owner connection
 * (migrations, cross-store admin jobs). On the app connection it sees nothing.
 * Named so it stands out in review.
 */
export async function withoutStore<T>(db: Db, fn: (tx: StoreTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx))
}
