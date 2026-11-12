import 'server-only'
import { loadEnv } from '@commerce/config'
import { listenStorefrontCache } from '@commerce/core'
import { logger } from '@commerce/observability/logging'

/**
 * One `storefront_cache` listener per process, shared by every cache that must drop a store's
 * data when the store changes: the render cache (`store-cache.ts`) and the proxy's small caches
 * (hosts, markets, redirects, the password lock). Postgres NOTIFYs on every write to a table a
 * page renders (migration 0115, `@commerce/db` `storefront-cache.ts`), so an admin edit reaches
 * every subscriber at once instead of waiting out a TTL.
 *
 * The hub lives on `globalThis`: the proxy and the app's server bundles are separate module
 * graphs in one process, and must share one listener (one Postgres connection).
 */

export type StoreChangeListener = {
  /** A write to a rendered table of this store committed (`soft`: media processing). */
  onChange?: (storeId: string, soft: boolean) => void
  /** Listening (again): anything before this may have been missed. Called at once if live. */
  onLive?: () => void
  /** The connection dropped: notifications are missed until `onLive`. */
  onLost?: () => void
}

export type StoreChangeHub = {
  /** Adds a listener; returns its removal. */
  subscribe: (listener: StoreChangeListener) => () => void
  change: (storeId: string, soft: boolean) => void
  live: () => void
  lost: () => void
  readonly isLive: boolean
}

/** A hub with no listener of its own (pure; `storeChanges` feeds the process's one). */
export function createStoreChangeHub(): StoreChangeHub {
  const listeners = new Set<StoreChangeListener>()
  let isLive = false
  // One listener throwing never keeps the change from the others.
  const each = (call: (l: StoreChangeListener) => void) => {
    for (const l of listeners) {
      try {
        call(l)
      } catch (error) {
        logger.error('store change listener failed', { error })
      }
    }
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      if (isLive) listener.onLive?.()
      return () => {
        listeners.delete(listener)
      }
    },
    change: (storeId, soft) => each((l) => l.onChange?.(storeId, soft)),
    live: () => {
      isLive = true
      each((l) => l.onLive?.())
    },
    lost: () => {
      isLive = false
      each((l) => l.onLost?.())
    },
    get isLive() {
      return isLive
    },
  }
}

const g = globalThis as unknown as {
  __storefrontChanges?: { hub: StoreChangeHub; started: boolean }
}

/**
 * The process's hub. The first call starts listening (lazily: a build imports these modules
 * with no database to listen to).
 */
export function storeChanges(): StoreChangeHub {
  g.__storefrontChanges ??= { hub: createStoreChangeHub(), started: false }
  const s = g.__storefrontChanges
  if (!s.started) {
    s.started = true
    // LISTEN needs a connection of its own for good, so never through PgBouncer.
    const env = loadEnv(process.env)
    listenStorefrontCache(env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, {
      onChange: s.hub.change,
      onLive: s.hub.live,
      onLost: s.hub.lost,
    })
  }
  return s.hub
}

/**
 * Subscribes `listener` to the process's hub once, on the first call; later calls do nothing.
 * For a module-level cache: call the returned function where the cache is used, so nothing
 * listens at import time.
 */
export function watchStoreChanges(listener: StoreChangeListener): () => void {
  let watching = false
  return () => {
    if (watching) return
    watching = true
    storeChanges().subscribe(listener)
  }
}

/**
 * The listener for a small per-process cache: drop a store's entries when it changes (soft
 * changes are media processing, which these caches never read), and everything when the listener
 * comes back, since changes in the gap were missed. While it is down, the cache's TTL still holds.
 */
export function dropOnStoreChange(forget: {
  store: (storeId: string) => void
  all: () => void
}): StoreChangeListener {
  return {
    onChange: (storeId, soft) => {
      if (!soft) forget.store(storeId)
    },
    onLive: forget.all,
  }
}

/** Keeps per-store resolver caches (`createStoreResolver`) in step with store writes. */
export function watchResolvers(
  ...resolvers: { forgetStore: (storeId: string) => void; clear: () => void }[]
): () => void {
  return watchStoreChanges(
    dropOnStoreChange({
      store: (storeId) => {
        for (const r of resolvers) r.forgetStore(storeId)
      },
      all: () => {
        for (const r of resolvers) r.clear()
      },
    }),
  )
}
