import {
  appSettingsOf,
  decryptSecret,
  encryptSecret,
  lockStoreApps,
  type ProductSearchEngine,
  parseAppsSettings,
  withAppSettings,
} from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { type MeiliClient, MeiliError, meiliClient, parseTrustedOrigins } from './client'
import { indexSettings, type ProductSource, toDocument } from './documents'
import {
  MEILISEARCH_ID,
  type MeilisearchSettings,
  normaliseMeilisearchHost,
  parseMeilisearchSettings,
  productsIndex,
  rebuildIndex,
  searchReady,
} from './settings'

/**
 * Everything that touches both Postgres and Meilisearch: connecting, the full reindex, the
 * incremental sync after product changes, and the storefront's search engine. Each Meilisearch
 * call happens outside any long transaction: rows are read in one short transaction, sent, and
 * the outcome recorded in another (the app role's idle-in-transaction timeout).
 */

/** The secret that opens the stored keys, and the origins reached without the SSRF guard. */
export type MeiliEnv = { secret: string; trustedOrigins: readonly string[] }

/** `MEILISEARCH_TRUSTED_ORIGINS` from the environment, for callers that only have a secret. */
export const meiliEnv = (
  secret: string,
  raw = process.env.MEILISEARCH_TRUSTED_ORIGINS,
): MeiliEnv => ({
  secret,
  trustedOrigins: parseTrustedOrigins(raw),
})

/** Runs `fn` in a transaction under the store's RLS (`AppHookContext.inStore`). */
export type InStore = <T>(fn: (tx: StoreTx) => Promise<T>) => Promise<T>

/** Products read per transaction and sent per request during a full reindex. */
export const REINDEX_BATCH = 500

// ── settings in store.apps ───────────────────────────────────────────────────────────────

export async function loadMeilisearchEntry(tx: StoreTx, storeId: string) {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    apps,
    installed: apps.installed.includes(MEILISEARCH_ID),
    settings: parseMeilisearchSettings(appSettingsOf(apps, MEILISEARCH_ID)),
  }
}

/** Re-reads the entry under a row lock and saves `change(entry)`, so two writers never clash. */
export async function updateMeilisearchEntry(
  tx: StoreTx,
  storeId: string,
  change: (current: MeilisearchSettings) => MeilisearchSettings,
): Promise<MeilisearchSettings> {
  const apps = await lockStoreApps(tx, storeId)
  const next = change(parseMeilisearchSettings(appSettingsOf(apps, MEILISEARCH_ID)))
  await tx
    .update(store)
    .set({ apps: withAppSettings(apps, MEILISEARCH_ID, next) })
    .where(eq(store.id, storeId))
  return next
}

/** A client with the admin key, or null when the address or key is missing or unreadable. */
export function adminClient(
  settings: MeilisearchSettings,
  env: MeiliEnv,
  extra: { fetch?: typeof fetch; timeoutMs?: number } = {},
): MeiliClient | null {
  return clientWith(settings, settings.adminKey, env, extra)
}

/** A client with the search-only key (the admin key when there is none). */
export function searchClient(
  settings: MeilisearchSettings,
  env: MeiliEnv,
  extra: { fetch?: typeof fetch; timeoutMs?: number } = {},
): MeiliClient | null {
  return clientWith(settings, settings.searchKey || settings.adminKey, env, extra)
}

function clientWith(
  settings: MeilisearchSettings,
  blob: string,
  env: MeiliEnv,
  extra: { fetch?: typeof fetch; timeoutMs?: number },
): MeiliClient | null {
  const host = normaliseMeilisearchHost(settings.host)
  if (!host || !blob) return null
  let apiKey: string
  try {
    apiKey = decryptSecret(blob, env.secret)
  } catch {
    return null
  }
  return meiliClient({ host, apiKey, trustedOrigins: env.trustedOrigins, ...extra })
}

// ── reading products ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

/**
 * Searchable products (active, not the payments test product) with everything their document
 * needs: either the given ids, or the next `limit` after `after` in id order (a reindex batch).
 */
export async function loadProductSources(
  tx: StoreTx,
  pick: { ids: readonly string[] } | { after: string | null; limit: number },
): Promise<ProductSource[]> {
  const where =
    'ids' in pick
      ? sql`p.id = any(string_to_array(${pick.ids.join(',')}, ',')::uuid[])`
      : pick.after
        ? sql`p.id > ${pick.after}::uuid`
        : sql`true`
  const limit = 'ids' in pick ? sql`` : sql`limit ${pick.limit}`
  const rows = await tx.execute<Row>(sql`
    select p.id, p.handle, p.title, p.vendor, p.product_type, p.tags, p.description, p.created_at,
      (select array_agg(distinct v.sku) from variant v
        where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false and coalesce(v.sku, '') <> '') as skus,
      (select array_agg(distinct pov.value) from product_option po
        join product_option_value pov on pov.option_id = po.id
        where po.product_id = p.id and lower(po.name) <> 'title') as option_values,
      (select array_agg(c.handle) from collection_product cp
        join collection c on c.id = cp.collection_id where cp.product_id = p.id) as collections,
      (select min(v.price_paise) from variant v where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false) as min_price,
      (select max(v.price_paise) from variant v where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false) as max_price,
      exists (
        select 1 from variant v
        left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = p.id and v.archived_at is null and v.hidden_on_store = false
          and (not v.track_inventory or coalesce(il.on_hand, 0) - coalesce(il.reserved, 0) > 0)
      ) as available,
      (select m.url from product_media pm join media m on m.id = pm.media_id
        where pm.product_id = p.id order by pm.position limit 1) as image
    from product p
    where p.status = 'active' and not p.is_system_test and ${where}
    order by p.id ${limit}`)
  return rows.map((r) => ({
    id: String(r.id),
    handle: String(r.handle),
    title: String(r.title),
    vendor: (r.vendor as string | null) ?? null,
    productType: (r.product_type as string | null) ?? null,
    tags: strings(r.tags),
    description: r.description,
    skus: strings(r.skus),
    optionValues: strings(r.option_values),
    collections: strings(r.collections),
    minPricePaise: numOrNull(r.min_price),
    maxPricePaise: numOrNull(r.max_price),
    available: r.available === true,
    createdAt: r.created_at as Date | string,
    image: (r.image as string | null) ?? null,
  }))
}

// ── connecting ───────────────────────────────────────────────────────────────────────────

/**
 * Proves the address and admin key, makes sure the store's index exists with our settings,
 * and creates a search-only key for it when there is none yet. Meilisearch's default admin
 * key may not create keys; then searches use the admin key (still only on our server) and the
 * page says so. Returns the server's version.
 */
export async function connectMeilisearch(
  tx: StoreTx,
  storeId: string,
  env: MeiliEnv,
  extra: { fetch?: typeof fetch } = {},
): Promise<{ version: string; searchKey: boolean }> {
  const { settings } = await loadMeilisearchEntry(tx, storeId)
  const client = adminClient(settings, env, extra)
  if (!client) throw new MeiliError('unauthorized')
  const version = await client.version()
  await ensureIndex(client, productsIndex(storeId), settings.synonyms)
  if (settings.searchKey) return { version, searchKey: true }
  try {
    const key = await client.createSearchKey({
      name: `storefront-${storeId}`,
      indexes: [productsIndex(storeId)],
    })
    await updateMeilisearchEntry(tx, storeId, (s) => ({
      ...s,
      searchKey: encryptSecret(key.key, env.secret),
      searchKeyUid: key.uid,
    }))
    return { version, searchKey: true }
  } catch (err) {
    if (err instanceof MeiliError && err.code === 'unauthorized')
      return { version, searchKey: false }
    throw err
  }
}

/** Create the index when it is missing (a failed "already exists" task is fine) and apply settings. */
async function ensureIndex(client: MeiliClient, uid: string, synonyms: string[][]) {
  try {
    await client.waitForTask(await client.createIndex(uid))
  } catch (err) {
    if (!(err instanceof MeiliError && err.code === 'task-failed')) throw err
  }
  await client.waitForTask(await client.updateSettings(uid, indexSettings(synonyms)))
}

/** Sends the saved synonyms (and the rest of the settings) to the live index. */
export async function pushIndexSettings(
  settings: MeilisearchSettings,
  storeId: string,
  env: MeiliEnv,
): Promise<void> {
  const client = adminClient(settings, env)
  if (!client) return
  await client.waitForTask(
    await client.updateSettings(productsIndex(storeId), indexSettings(settings.synonyms)),
  )
}

/** Deletes the search-only key in Meilisearch when the merchant removes the admin key. */
export async function revokeSearchKey(settings: MeilisearchSettings, env: MeiliEnv): Promise<void> {
  if (!settings.searchKeyUid) return
  await adminClient(settings, env)
    ?.deleteKey(settings.searchKeyUid)
    .catch(() => {})
}

/** Live numbers for the admin page: documents in the index and whether it is still indexing. */
export async function indexStats(
  settings: MeilisearchSettings,
  storeId: string,
  env: MeiliEnv,
): Promise<{ documents: number; indexing: boolean } | null> {
  const client = adminClient(settings, env, { timeoutMs: 5_000 })
  if (!client) return null
  return client.stats(productsIndex(storeId))
}

// ── indexing ─────────────────────────────────────────────────────────────────────────────

const failureText = (err: unknown) =>
  err instanceof Error && err.message ? err.message.slice(0, 500) : 'Meilisearch sync failed.'

/**
 * Rebuild the store's index from Postgres: a fresh `…_rebuild` index gets every searchable
 * product in batches, then swaps places with the live one, so shoppers never search a half
 * index. Products edited while it ran are sent again afterwards. Records the count and time,
 * or the failure (and rethrows, so the job retries).
 */
export async function reindexStore(deps: {
  storeId: string
  inStore: InStore
  env: MeiliEnv
  fetch?: typeof fetch
}): Promise<{ documents: number }> {
  const { storeId, inStore, env } = deps
  const startedAt = new Date()
  const settings = await inStore(async (tx) => (await loadMeilisearchEntry(tx, storeId)).settings)
  const client = adminClient(settings, env, deps.fetch ? { fetch: deps.fetch } : {})
  if (!client) return { documents: 0 }
  const live = productsIndex(storeId)
  const next = rebuildIndex(storeId)
  try {
    await dropIndex(client, next)
    await ensureIndex(client, next, settings.synonyms)
    let after: string | null = null
    let documents = 0
    for (;;) {
      const cursor: string | null = after
      const batch: ProductSource[] = await inStore((tx) =>
        loadProductSources(tx, { after: cursor, limit: REINDEX_BATCH }),
      )
      if (!batch.length) break
      await client.waitForTask(await client.addDocuments(next, batch.map(toDocument)), {
        timeoutMs: 300_000,
      })
      documents += batch.length
      after = batch.at(-1)?.id ?? null
      if (batch.length < REINDEX_BATCH) break
    }
    await ensureIndex(client, live, settings.synonyms)
    await client.waitForTask(await client.swapIndexes(live, next))
    await dropIndex(client, next)
    const edited = await inStore((tx) => productsEditedSince(tx, startedAt))
    if (edited.length) await sendProducts(client, live, inStore, edited)
    await inStore((tx) =>
      updateMeilisearchEntry(tx, storeId, (s) => ({
        ...s,
        lastSyncAt: new Date().toISOString(),
        lastSyncCount: documents,
        lastError: null,
        reindexRequestedAt: null,
      })),
    )
    return { documents }
  } catch (err) {
    await inStore((tx) =>
      updateMeilisearchEntry(tx, storeId, (s) => ({
        ...s,
        lastError: failureText(err),
        reindexRequestedAt: null,
      })),
    )
    throw err
  }
}

async function dropIndex(client: MeiliClient, uid: string) {
  try {
    await client.waitForTask(await client.deleteIndex(uid))
  } catch (err) {
    if (!(err instanceof MeiliError && (err.code === 'not-found' || err.code === 'task-failed')))
      throw err
  }
}

async function productsEditedSince(tx: StoreTx, since: Date): Promise<string[]> {
  const rows = await tx.execute<Row>(
    sql`select id from product where updated_at >= ${since.toISOString()}::timestamptz`,
  )
  return rows.map((r) => String(r.id))
}

/** Upsert the products that are searchable and delete the rest (gone, draft or archived). */
async function sendProducts(
  client: MeiliClient,
  uid: string,
  inStore: InStore,
  productIds: readonly string[],
): Promise<{ upserted: number; deleted: number }> {
  const sources = await inStore((tx) => loadProductSources(tx, { ids: productIds }))
  const found = new Set(sources.map((s) => s.id))
  const gone = productIds.filter((id) => !found.has(id))
  if (sources.length) await client.addDocuments(uid, sources.map(toDocument))
  if (gone.length) await client.deleteDocuments(uid, gone)
  return { upserted: sources.length, deleted: gone.length }
}

/**
 * The incremental sync for `products.changed`: brings these products' documents up to date.
 * Skipped until the first full reindex ran (that one will include them). Writes are queued in
 * Meilisearch, not waited for; a failure is recorded and rethrown so the job retries.
 */
export async function syncProducts(deps: {
  storeId: string
  inStore: InStore
  env: MeiliEnv
  productIds: readonly string[]
  fetch?: typeof fetch
}): Promise<{ upserted: number; deleted: number } | null> {
  const { storeId, inStore, env } = deps
  const settings = await inStore(async (tx) => (await loadMeilisearchEntry(tx, storeId)).settings)
  if (!settings.lastSyncAt || !deps.productIds.length) return null
  const client = adminClient(settings, env, deps.fetch ? { fetch: deps.fetch } : {})
  if (!client) return null
  try {
    const result = await sendProducts(client, productsIndex(storeId), inStore, deps.productIds)
    await inStore((tx) =>
      updateMeilisearchEntry(tx, storeId, (s) => ({
        ...s,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      })),
    )
    return result
  } catch (err) {
    await inStore((tx) =>
      updateMeilisearchEntry(tx, storeId, (s) => ({ ...s, lastError: failureText(err) })),
    )
    throw err
  }
}

// ── the storefront's search engine ───────────────────────────────────────────────────────

/** After a failed search, Meilisearch is skipped for this long (per address) so SQL answers at once. */
export const COOL_OFF_MS = 30_000

/**
 * The search engine core's `browseProducts` and `suggestProducts` ask (`setProductSearchEngine`).
 * Null (SQL runs) unless the store installed the app, connected it and indexed once. One failed
 * call cools that Meilisearch off for `COOL_OFF_MS`, so an outage costs one slow search, not
 * every search.
 */
export function meilisearchEngine(
  env: MeiliEnv,
  opts: { fetch?: typeof fetch; now?: () => number } = {},
): ProductSearchEngine {
  const now = opts.now ?? Date.now
  const failedAt = new Map<string, number>()
  return async ({ tx, storeId, query, limit, signal }) => {
    const { installed, settings } = await loadMeilisearchEntry(tx, storeId)
    if (!installed || !searchReady(settings)) return null
    const host = settings.host
    const since = failedAt.get(host)
    if (since !== undefined && now() - since < COOL_OFF_MS) return null
    const client = searchClient(settings, env, opts.fetch ? { fetch: opts.fetch } : {})
    if (!client) return null
    try {
      const ids = await client.searchIds(productsIndex(storeId), { query, limit, signal })
      failedAt.delete(host)
      return ids
    } catch (err) {
      failedAt.set(host, now())
      throw err
    }
  }
}
