/** SOURCE OF TRUTH: closing a store — deletes every store_id row in foreign-key order, then its files */
import { authSchema, media, type StoreTx, store } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { eq, sql } from 'drizzle-orm'
import { deletionOrder, listStoreTables } from './tables'

export type StoreRowsDeleted = {
  /** Rows removed per table, by table name (tables with none are left out). */
  tables: Record<string, number>
  rows: number
  organizationId: string | null
}

/** The folder every file of one store lives under in its storage (see `mediaKey`). */
export const storeFilesPrefix = (storeId: string): string => `stores/${storeId}/`

/**
 * Deletes every row of one store: each table with a `store_id`, children before parents
 * (`deletionOrder`), then the `store` row, then the store's Better Auth organization
 * (members and pending invitations go with it) and any session still pointing at it.
 *
 * Call it inside the store's own transaction (`withStore` on the app connection): RLS
 * keeps every `delete` to this store even if a `where` here were wrong, and a failure
 * part-way rolls the whole store back. `app.store_delete` lets the append-only privacy
 * audit trail be removed with its store (migration 0078); it is transaction-local.
 */
export async function deleteStoreRows(tx: StoreTx, storeId: string): Promise<StoreRowsDeleted> {
  const [row] = await tx
    .select({ organizationId: store.organizationId })
    .from(store)
    .where(eq(store.id, storeId))
  if (!row) throw new Error('store not found')

  await tx.execute(sql`select set_config('app.store_delete', ${storeId}, true)`)
  const tables: Record<string, number> = {}
  let rows = 0
  for (const table of deletionOrder(await listStoreTables(tx))) {
    const result = await tx.execute(
      sql`delete from ${sql.identifier(table)} where store_id = ${storeId}`,
    )
    const count = Number((result as { count?: number }).count ?? 0)
    if (count > 0) tables[table] = count
    rows += count
  }
  await tx.delete(store).where(eq(store.id, storeId))

  const organizationId = row.organizationId
  if (organizationId) {
    await tx
      .update(authSchema.session)
      .set({ activeOrganizationId: null })
      .where(eq(authSchema.session.activeOrganizationId, organizationId))
    // Members and invitations cascade from the organization.
    await tx.delete(authSchema.organization).where(eq(authSchema.organization.id, organizationId))
  }
  return { tables, rows, organizationId }
}

/** Object keys the store's media rows point at, by the provider that holds them. */
export async function storeMediaKeys(
  tx: StoreTx,
): Promise<{ provider: string | null; key: string }[]> {
  const rows = await tx.select({ provider: media.provider, key: media.key }).from(media)
  return rows.flatMap((r) => (r.key ? [{ provider: r.provider, key: r.key }] : []))
}

/**
 * Deletes a store's files from each storage it may have used (its current one and the
 * local folder files were uploaded to before a bucket was connected). A provider that can
 * delete a whole folder clears `stores/<id>/`; any other deletes the media keys it is
 * known to hold, one by one. Resolves how many objects went.
 */
export async function deleteStoreFiles(
  providers: StorageProvider[],
  storeId: string,
  keys: { provider: string | null; key: string }[],
): Promise<number> {
  let deleted = 0
  const seen = new Set<string>()
  for (const provider of providers) {
    if (seen.has(provider.id)) continue
    seen.add(provider.id)
    if (provider.deletePrefix) {
      deleted += await provider.deletePrefix(storeFilesPrefix(storeId))
      continue
    }
    // Rows from before `media.provider` existed have none; they were uploaded locally.
    for (const k of keys.filter((k) => (k.provider ?? 'local') === provider.id)) {
      await provider.delete(k.key)
      deleted += 1
    }
  }
  return deleted
}
