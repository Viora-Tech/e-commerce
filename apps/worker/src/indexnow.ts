/**
 * IndexNow auto-notify: every few minutes, each store with a live custom domain that search
 * engines may index tells Bing, Yandex and the other IndexNow engines which product, collection
 * and page URLs changed (edited since the last run, or deleted: `seo.paths_removed` outbox rows
 * the relay hands to `noteIndexNowRemoved`). One batched POST per store per run at most, so a
 * bulk edit is one ping, not hundreds. A failed POST is logged and not retried: the next change
 * pings again. Nothing for the merchant to set: Preferences › search engines off, or the password
 * page, stops it (`indexNowHost`). Rules: `@commerce/core` `seo/indexnow.ts`.
 */
import {
  ensureIndexNowKey,
  indexNowChangedPaths,
  indexNowPayloads,
  indexNowTarget,
  submitIndexNow,
} from '@commerce/core'
import { type Db, liveStorefrontHosts, resolveHost, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { IORedis } from '@commerce/queue'

/** How often stores ping: also the shortest gap between two pings of one store. */
export const INDEXNOW_EVERY_MS = 5 * 60_000

/** Deleted paths waiting for the next run, per store (`noteIndexNowRemoved`). */
const removedKey = (storeId: string) => `indexnow:removed:${storeId}`
/** When the store's last run looked for changes (ISO). */
const cursorKey = (storeId: string) => `indexnow:since:${storeId}`

/** The most deleted paths kept per store between runs; a store that cannot ping keeps them a day. */
const MAX_REMOVED = 10_000
const KEEP_SECONDS = 24 * 60 * 60

/** The relay's hook for `seo.paths_removed`: queue the paths for the store's next run. */
export async function noteIndexNowRemoved(
  redis: IORedis,
  storeId: string,
  paths: readonly string[],
): Promise<void> {
  if (!paths.length) return
  const key = removedKey(storeId)
  await redis
    .multi()
    .rpush(key, ...paths)
    .ltrim(key, -MAX_REMOVED, -1)
    .expire(key, KEEP_SECONDS)
    .exec()
}

/** Take (and clear) the store's queued deleted paths. */
async function takeRemoved(redis: IORedis, storeId: string): Promise<string[]> {
  const key = removedKey(storeId)
  const res = await redis.multi().lrange(key, 0, -1).del(key).exec()
  const list = res?.[0]?.[1]
  return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
}

export type IndexNowStoreRun = { storeId: string; host: string | null; urls: number; ok: boolean }

/**
 * One store's run: the changes since its cursor plus its deleted paths, sent once. The first run
 * (no cursor) only sets the cursor, so a deploy does not announce the whole catalogue.
 */
export async function runIndexNowStore(
  db: Db,
  redis: IORedis,
  storeId: string,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowStoreRun> {
  const target = await withStore(db, storeId, (tx) => indexNowTarget(tx, storeId))
  if (!target.host) {
    // Not pingable now: drop the cursor so changes made meanwhile are not announced later in bulk.
    await redis.del(cursorKey(storeId))
    return { storeId, host: null, urls: 0, ok: true }
  }
  const host = target.host
  const since = await redis.get(cursorKey(storeId))
  await redis.set(cursorKey(storeId), now.toISOString(), 'EX', KEEP_SECONDS)
  if (!since) return { storeId, host, urls: 0, ok: true }
  const changed = await withStore(db, storeId, (tx) => indexNowChangedPaths(tx, new Date(since)))
  const paths = [...changed, ...(await takeRemoved(redis, storeId))]
  if (!paths.length) return { storeId, host, urls: 0, ok: true }
  const key = target.key ?? (await withStore(db, storeId, (tx) => ensureIndexNowKey(tx, storeId)))
  const results = await submitIndexNow(indexNowPayloads(host, key, paths), fetchImpl)
  const urls = results.reduce((n, r) => n + r.urls, 0)
  const ok = results.every((r) => r.ok)
  const statuses = results.map((r) => r.status)
  if (ok) logger.info('indexnow sent', { area: 'indexnow', storeId, host, urls, statuses })
  else logger.warn('indexnow failed', { area: 'indexnow', storeId, host, urls, statuses })
  return { storeId, host, urls, ok }
}

/** The sweep: every live store's primary host, one run each; one store failing skips only it. */
export function createIndexNowSweep(db: Db, redis: IORedis, fetchImpl: typeof fetch = fetch) {
  const run = async () => {
    const now = new Date()
    let sent = 0
    let stores = 0
    for (const hostname of await liveStorefrontHosts(db)) {
      try {
        const route = await resolveHost(db, hostname)
        if (!route || route.redirect) continue
        const r = await runIndexNowStore(db, redis, route.storeId, now, fetchImpl)
        if (r.urls) {
          stores += 1
          sent += r.urls
        }
      } catch (err) {
        logger.warn('indexnow run failed', { area: 'indexnow', hostname, error: err })
      }
    }
    return { stores, sent }
  }
  return { run }
}
