/** SOURCE OF TRUTH: IndexNow's database side — WHAT: whether a store may ping and on which host, its key (made on first use and kept in `store.preferences.indexNow`), the product, collection and page paths changed since the last ping, and the `seo.paths_removed` outbox row the delete paths write / WHY: the worker's IndexNow sweep (`apps/worker/src/indexnow.ts`) and the storefront's key file read one place, inside RLS */
import { collection, page, product, type StoreTx, store, storeDomain } from '@commerce/db'
import { and, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import { txStoreId } from '../catalog/changes'
import { notSystemTest } from '../catalog/system-test'
import { parsePreferences, searchIndexable } from '../online-store/preferences'
import { insertOutboxEvent } from '../outbox/write'
import {
  INDEXNOW_MAX_URLS,
  indexNowHost,
  indexNowPath,
  newIndexNowKey,
  readIndexNowKey,
} from './indexnow'

/** The host to ping for the store in scope and its key (null key: none made yet); null host: no ping. */
export async function indexNowTarget(
  tx: StoreTx,
  storeId: string,
): Promise<{ host: string | null; key: string | null }> {
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  const [domain] = await tx
    .select({
      hostname: storeDomain.hostname,
      kind: storeDomain.kind,
      status: storeDomain.status,
      sslStatus: storeDomain.sslStatus,
    })
    .from(storeDomain)
    .where(eq(storeDomain.isPrimary, true))
  const host = indexNowHost({
    domain: domain ?? null,
    indexable: searchIndexable(parsePreferences(s?.preferences)),
  })
  return { host, key: readIndexNowKey(s?.preferences) }
}

/**
 * The store's key, made and saved the first time (one write to the store row, ever). Kept under
 * its own top-level `indexNow` entry, which saving Preferences leaves alone.
 */
export async function ensureIndexNowKey(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  const existing = readIndexNowKey(s?.preferences)
  if (existing) return existing
  const key = newIndexNowKey()
  await tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ indexNow: { key } })}::jsonb`,
    })
    .where(eq(store.id, storeId))
  return key
}

/** The key a storefront `/<key>.txt` request may show: the store's own, else null (a 404). */
export async function indexNowKeyFor(tx: StoreTx, storeId: string): Promise<string | null> {
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return readIndexNowKey(s?.preferences)
}

/**
 * Paths of live products (and archived ones, so engines drop them), active collections and
 * published pages edited after `since`.
 */
export async function indexNowChangedPaths(tx: StoreTx, since: Date): Promise<string[]> {
  const products = await tx
    .select({ handle: product.handle })
    .from(product)
    .where(
      and(
        gt(product.updatedAt, since),
        inArray(product.status, ['active', 'archived']),
        notSystemTest,
      ),
    )
    .limit(INDEXNOW_MAX_URLS)
  const collections = await tx
    .select({ handle: collection.handle })
    .from(collection)
    .where(and(gt(collection.updatedAt, since), eq(collection.status, 'active')))
    .limit(INDEXNOW_MAX_URLS)
  const pages = await tx
    .select({ handle: page.handle })
    .from(page)
    .where(and(gt(page.updatedAt, since), isNotNull(page.publishedAt)))
    .limit(INDEXNOW_MAX_URLS)
  return [
    ...products.map((r) => indexNowPath('product', r.handle)),
    ...collections.map((r) => indexNowPath('collection', r.handle)),
    ...pages.map((r) => indexNowPath('page', r.handle)),
  ]
}

/**
 * Record, in the deleting transaction, that a product, collection or page URL shoppers could open
 * is gone. `live`: it was on the store (an active or archived product, an active collection, a
 * published page); a draft's address was never public, so it is not announced.
 */
export async function noteIndexNowRemoved(
  tx: StoreTx,
  resource: 'product' | 'collection' | 'page',
  removed: { handle: string; live: boolean } | undefined,
): Promise<void> {
  if (!removed?.live) return
  const storeId = await txStoreId(tx)
  if (!storeId) return
  const handle = removed.handle
  await insertOutboxEvent(tx, storeId, 'seo.paths_removed', {
    paths: [indexNowPath(resource, handle)],
  })
}
