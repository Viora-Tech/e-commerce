import {
  type CloudflarePurgeConfig,
  EdgePurgePlan,
  listenStorefrontCache,
  purgeCloudflareHosts,
  purgeCloudflareZone,
} from '@commerce/core'
import { type Db, storeDomain, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'

/** How often due purges are looked for. */
const TICK_MS = 1_000

/**
 * After a storefront starts (a deploy), the zone is purged twice: once the new process is likely
 * serving, and again once a rolling deploy's old container is surely gone, so no page that points
 * at the old build's scripts stays at the edge.
 */
const START_PURGES_MS = [30_000, 120_000]

/** Every hostname that serves the store's pages (a redirect-only one too: purging it is free). */
async function storeHostnames(db: Db, storeId: string): Promise<string[]> {
  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select({ hostname: storeDomain.hostname })
      .from(storeDomain)
      .where(eq(storeDomain.status, 'active')),
  )
  return rows.map((r) => r.hostname)
}

/**
 * Keeps Cloudflare's copy of store pages as fresh as the origin's (`STOREFRONT_EDGE_TTL` can then
 * be minutes): listens on the same `storefront_cache` channel the storefront does and, once a
 * store's writes settle (`EdgePurgePlan`), purges that store's hostnames. A failed purge is
 * retried with the next write or tick; if the listener lost its connection (writes may have been
 * missed) the whole zone is purged once it is back. Off without `CLOUDFLARE_CACHE_PURGE_TOKEN`.
 */
export function startEdgePurge(
  db: Db,
  listenUrl: string,
  config: CloudflarePurgeConfig,
): { close: () => Promise<void> } {
  const plan = new EdgePurgePlan()
  let lost = false
  let busy = false

  const tick = async () => {
    if (busy) return
    busy = true
    try {
      const due = plan.take(Date.now())
      for (const storeId of due) {
        try {
          const hosts = await storeHostnames(db, storeId)
          await purgeCloudflareHosts(config, hosts)
          logger.info('edge cache purged', { area: 'edge-purge', storeId, hosts: hosts.length })
        } catch (err) {
          // Try again after the usual gap; the edge's TTL is the backstop meanwhile.
          plan.note(storeId, false, Date.now())
          logger.warn('edge cache purge failed', { area: 'edge-purge', storeId, error: err })
        }
      }
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void tick(), TICK_MS)
  timer.unref?.()

  const purgeZone = (why: string) =>
    purgeCloudflareZone(config)
      .then(() => logger.info('edge cache purged', { area: 'edge-purge', why }))
      .catch((err) =>
        logger.warn('edge zone purge failed', { area: 'edge-purge', why, error: err }),
      )
  const startTimers = new Set<ReturnType<typeof setTimeout>>()

  const listener = listenStorefrontCache(listenUrl, {
    onChange: (storeId, soft) => plan.note(storeId, soft, Date.now()),
    onLost: () => {
      lost = true
    },
    onLive: () => {
      if (!lost) return
      lost = false
      void purgeZone('listener reconnected')
    },
    onStorefrontStart: () => {
      // A second start within the window (several processes, a restart) reuses the same purges.
      if (startTimers.size > 0) return
      for (const ms of START_PURGES_MS) {
        const t = setTimeout(() => {
          startTimers.delete(t)
          void purgeZone('storefront started')
        }, ms)
        t.unref?.()
        startTimers.add(t)
      }
    },
  })

  return {
    close: async () => {
      clearInterval(timer)
      for (const t of startTimers) clearTimeout(t)
      await listener.close()
    },
  }
}
