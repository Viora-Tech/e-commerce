import 'server-only'
import { builtInRedirect, findRedirect, hasRedirects, normaliseRedirectPath } from '@commerce/core'
import { withStore } from '@commerce/db'
import { db } from './db'
import { LruCache } from './lru-cache'
import { dropOnStoreChange, watchStoreChanges } from './store-changes'

/**
 * URL redirects for the proxy. Each lookup is cached per process: most stores have none (one
 * cheap check per TTL), and a store that does pays one indexed lookup per distinct path per TTL.
 * An edit in the admin drops the store's entries at once (`storefront_cache` notifies on
 * `url_redirect`); the TTL only covers a lost listener.
 */
const TTL_MS = 30_000
const MAX_ENTRIES = 5_000

const anyCache = new LruCache<{ value: boolean }>({ maxSize: MAX_ENTRIES })
const pathCache = new LruCache<{ value: string | null }>({ maxSize: MAX_ENTRIES })

const pathKey = (storeId: string, path: string) => `${storeId}|${path}`

const watch = watchStoreChanges(
  dropOnStoreChange({
    store: (storeId) => {
      anyCache.delete(storeId)
      pathCache.deleteWhere((key) => key.startsWith(`${storeId}|`))
    },
    all: () => {
      anyCache.clear()
      pathCache.clear()
    },
  }),
)

async function storeHasRedirects(storeId: string): Promise<boolean> {
  const hit = anyCache.get(storeId)
  if (hit) return hit.value
  const value = await withStore(db(), storeId, (tx) => hasRedirects(tx))
  anyCache.set(storeId, { value }, 1, TTL_MS)
  return value
}

/** Where a request for `pathname` should go instead, or null to serve it. */
export async function redirectFor(storeId: string, pathname: string): Promise<string | null> {
  if (pathname === '/') return null
  watch()
  if (await storeHasRedirects(storeId)) {
    const path = normaliseRedirectPath(pathname)
    const key = pathKey(storeId, path)
    const hit = pathCache.get(key)
    const target = hit ? hit.value : await withStore(db(), storeId, (tx) => findRedirect(tx, path))
    if (!hit) pathCache.set(key, { value: target }, 1, TTL_MS)
    if (target) return target
  }
  return builtInRedirect(pathname)
}
