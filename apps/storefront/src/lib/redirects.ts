import 'server-only'
import { builtInRedirect, findRedirect, hasRedirects, normaliseRedirectPath } from '@commerce/core'
import { withStore } from '@commerce/db'
import { db } from './db'

/**
 * URL redirects for the proxy. Each lookup is cached briefly per process: most
 * stores have none (one cheap check per TTL), and a store that does pays one
 * indexed lookup per distinct path per TTL. Edits in the admin show within it.
 */
const TTL_MS = 30_000
const MAX_ENTRIES = 5_000

const anyCache = new Map<string, { value: boolean; expiresAt: number }>()
const pathCache = new Map<string, { value: string | null; expiresAt: number }>()

function remember<V>(cache: Map<string, { value: V; expiresAt: number }>, key: string, value: V) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
}

async function storeHasRedirects(storeId: string): Promise<boolean> {
  const hit = anyCache.get(storeId)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const value = await withStore(db(), storeId, (tx) => hasRedirects(tx))
  remember(anyCache, storeId, value)
  return value
}

/** Where a request for `pathname` should go instead, or null to serve it. */
export async function redirectFor(storeId: string, pathname: string): Promise<string | null> {
  if (pathname === '/') return null
  if (await storeHasRedirects(storeId)) {
    const path = normaliseRedirectPath(pathname)
    const key = `${storeId}${path}`
    const hit = pathCache.get(key)
    const target =
      hit && hit.expiresAt > Date.now()
        ? hit.value
        : await withStore(db(), storeId, (tx) => findRedirect(tx, path))
    if (!hit || hit.expiresAt <= Date.now()) remember(pathCache, key, target)
    if (target) return target
  }
  return builtInRedirect(pathname)
}
