import { sql } from 'drizzle-orm'
import type { Db } from './client'

export type StoreTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Run `fn` inside a transaction scoped to one store. RLS policies read
 * `app.store_id`, so every query in `fn` sees only that store's rows. `catalogId` also sets
 * `app.catalog_id` (the storefront's market sells from that catalog only: Markets › Catalogs),
 * and `actorName` sets `app.actor_name` (who is acting, for rows that record it by column
 * default: stock history). All of them go in one statement: every admin call opens one of these
 * transactions, so a second `set_config` round trip cost each page dozens.
 */
export async function withStore<T>(
  db: Db,
  storeId: string,
  fn: (tx: StoreTx) => Promise<T>,
  options: { catalogId?: string | null | undefined; actorName?: string | undefined } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    const settings = [sql`set_config('app.store_id', ${storeId}, true)`]
    if (options.catalogId)
      settings.push(sql`set_config('app.catalog_id', ${options.catalogId}, true)`)
    if (options.actorName !== undefined) {
      settings.push(sql`set_config('app.actor_name', ${options.actorName}, true)`)
    }
    await tx.execute(sql`select ${sql.join(settings, sql`, `)}`)
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
