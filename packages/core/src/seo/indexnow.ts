/** SOURCE OF TRUTH: IndexNow (Bing, Yandex, Seznam, Naver) — WHAT: each store's key (random, kept in `store.preferences.indexNow.key`), the `/<key>.txt` path the storefront answers it on, which stores may ping (a live custom primary domain, search engines allowed, no password page), and the batched POST body sent to api.indexnow.org / WHY: search engines hear about a new or changed product, collection or page within minutes instead of at the next crawl, with nothing for the merchant to set up. Pure and edge-safe: no database */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** The most URLs one IndexNow POST may carry. */
export const INDEXNOW_MAX_URLS = 10_000

/** A store's key: 32 lowercase hex characters (IndexNow allows 8–128 of `[a-zA-Z0-9-]`). */
const KEY = /^[a-f0-9]{32}$/
const KEY_PATH = /^\/([a-f0-9]{32})\.txt$/

/** A new random key. */
export function newIndexNowKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The key a storefront path asks for (`/<key>.txt`), or null for any other path. */
export function indexNowKeyFromPath(pathname: string): string | null {
  return KEY_PATH.exec(pathname)?.[1] ?? null
}

/** The store's key from its stored preferences (raw jsonb), or null when it has none yet. */
export function readIndexNowKey(preferences: unknown): string | null {
  if (!preferences || typeof preferences !== 'object') return null
  const entry = (preferences as { indexNow?: unknown }).indexNow
  if (!entry || typeof entry !== 'object') return null
  const key = (entry as { key?: unknown }).key
  return typeof key === 'string' && KEY.test(key) ? key : null
}

/** What decides whether a store pings: its primary domain and its search settings. */
export type IndexNowStoreFacts = {
  domain: { hostname: string; kind: string; status: string; sslStatus: string } | null
  /** `searchIndexable(preferences)`: no password page and search engines allowed. */
  indexable: boolean
}

/** The hostname to ping for, or null when the store has no live custom domain or hides from search. */
export function indexNowHost(facts: IndexNowStoreFacts): string | null {
  const d = facts.domain
  if (!facts.indexable || !d) return null
  if (d.kind !== 'custom' || d.status !== 'active' || d.sslStatus !== 'active') return null
  const host = d.hostname.toLowerCase()
  if (/(^|\.)localhost$/.test(host)) return null
  return host
}

export type IndexNowPayload = {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

/**
 * The POST bodies for `paths` (store paths like `/products/mouse`) on `host`: absolute HTTPS
 * URLs, each once, at most `INDEXNOW_MAX_URLS` per body. Empty when there is nothing to send.
 */
export function indexNowPayloads(
  host: string,
  key: string,
  paths: readonly string[],
  max: number = INDEXNOW_MAX_URLS,
): IndexNowPayload[] {
  const origin = `https://${host}`
  const urls = [
    ...new Set(
      paths
        .map((p) => p.trim())
        .filter((p) => p.startsWith('/') && !p.startsWith('//'))
        .map((p) => `${origin}${p}`),
    ),
  ]
  const out: IndexNowPayload[] = []
  for (let i = 0; i < urls.length; i += max) {
    out.push({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: urls.slice(i, i + max) })
  }
  return out
}

/** The store path of a product, collection or page handle. */
export function indexNowPath(resource: 'product' | 'collection' | 'page', handle: string): string {
  const prefix =
    resource === 'product' ? 'products' : resource === 'collection' ? 'collections' : 'pages'
  return `/${prefix}/${encodeURIComponent(handle)}`
}

export type IndexNowResult = { ok: boolean; status: number | null; urls: number }

/**
 * POST each body once. Never throws and never retries: a failure is reported in the result (the
 * caller logs it) and the next change pings again.
 */
export async function submitIndexNow(
  payloads: readonly IndexNowPayload[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<IndexNowResult[]> {
  const results: IndexNowResult[] = []
  for (const body of payloads) {
    try {
      const res = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      // 200 and 202 both mean received; 202 while the key file is still being checked.
      results.push({ ok: res.ok, status: res.status, urls: body.urlList.length })
      await res.body?.cancel()
    } catch {
      results.push({ ok: false, status: null, urls: body.urlList.length })
    }
  }
  return results
}
