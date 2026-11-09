/** SOURCE OF TRUTH: Cloudflare edge purge for store pages — WHAT: when to purge a store's hostnames after its pages change (`EdgePurgePlan`) and the purge call itself (`purgeCloudflareHosts`) / WHY: store pages sit in Cloudflare's cache for `STOREFRONT_EDGE_TTL`; the origin hears every write (`storefront_cache` NOTIFY) but the edge cannot, so a long TTL needs a purge to stay as fresh as a 30 s one */

/*
 * Endpoint, checked against developers.cloudflare.com/api/resources/cache (2026-11-09):
 * `POST /zones/{zone}/purge_cache` `{ hosts: [...] }` (at most 30 per call) or
 * `{ purge_everything: true }`. Purge by hostname is on every plan; on Cloudflare for SaaS the
 * custom hostnames' cache lives in the SaaS zone, so the zone is `CLOUDFLARE_ZONE_ID`.
 * Auth: `Authorization: Bearer`, a token with "Zone → Cache Purge: Purge" on that zone only. The
 * token only ever goes in that header: never in a URL, a log line or an error.
 */

import { CloudflareError } from './cloudflare'

/** A write settles this long before its purge, so one save's several writes cost one purge. */
export const PURGE_QUIET_MS = 5_000
/** Never later than this after the first unpurged write, even while writes keep coming. */
export const PURGE_MAX_WAIT_MS = 30_000
/** At most one purge per store this often (Cloudflare rate-limits purges per zone). */
export const PURGE_MIN_GAP_MS = 30_000
/**
 * A soft write (media processing) reaches the origin's cache only after its delay
 * (`SOFT_DELAY_MS`, 60 s, storefront `cache-versions.ts`): purging earlier would refill the edge
 * with the old page.
 */
export const PURGE_SOFT_DELAY_MS = 60_000
/** Cloudflare's limit on hostnames in one purge call. */
export const PURGE_HOSTS_PER_CALL = 30

type Pending = { first: number; last: number; softReady: number }

/**
 * Which stores are due a purge, from the writes the listener reported. Pure and clock-driven
 * (`now` is passed in), so the timing rules are tested without timers.
 */
export class EdgePurgePlan {
  private readonly pending = new Map<string, Pending>()
  private readonly lastPurge = new Map<string, number>()

  /** A committed write to one of the store's rendered tables. */
  note(storeId: string, soft: boolean, now: number): void {
    const p = this.pending.get(storeId) ?? { first: now, last: now, softReady: 0 }
    p.last = now
    if (soft) p.softReady = Math.max(p.softReady, now + PURGE_SOFT_DELAY_MS + PURGE_QUIET_MS)
    this.pending.set(storeId, p)
  }

  /** When the store's purge is due, or null with nothing pending. */
  dueAt(storeId: string): number | null {
    const p = this.pending.get(storeId)
    if (!p) return null
    const settled = Math.min(p.last + PURGE_QUIET_MS, p.first + PURGE_MAX_WAIT_MS)
    const gap = (this.lastPurge.get(storeId) ?? Number.NEGATIVE_INFINITY) + PURGE_MIN_GAP_MS
    return Math.max(settled, gap, p.softReady)
  }

  /** The stores due by `now`, taken off the pending list and stamped as purged. */
  take(now: number): string[] {
    const due: string[] = []
    for (const storeId of this.pending.keys()) {
      const at = this.dueAt(storeId)
      if (at !== null && at <= now) due.push(storeId)
    }
    for (const storeId of due) {
      this.pending.delete(storeId)
      this.lastPurge.set(storeId, now)
    }
    return due
  }

  /** How many stores wait for a purge. */
  get size(): number {
    return this.pending.size
  }
}

export type CloudflarePurgeConfig = {
  /** "Zone → Cache Purge" on the SaaS zone; nothing else. */
  apiToken: string
  zoneId: string
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>

const API = 'https://api.cloudflare.com/client/v4'
const TIMEOUT_MS = 8_000

/** The purge settings from env, or null when either is missing (purging is then off). */
export function cloudflarePurgeConfigFrom(env: {
  CLOUDFLARE_CACHE_PURGE_TOKEN?: string | undefined
  CLOUDFLARE_ZONE_ID?: string | undefined
}): CloudflarePurgeConfig | null {
  const apiToken = env.CLOUDFLARE_CACHE_PURGE_TOKEN?.trim()
  const zoneId = env.CLOUDFLARE_ZONE_ID?.trim()
  return apiToken && zoneId ? { apiToken, zoneId } : null
}

async function purge(
  config: CloudflarePurgeConfig,
  body: { hosts: string[] } | { purge_everything: true },
  doFetch: Fetch,
): Promise<void> {
  let res: Response
  try {
    res = await doFetch(`${API}/zones/${encodeURIComponent(config.zoneId)}/purge_cache`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    })
  } catch {
    throw new CloudflareError('Cloudflare cache purge could not be reached', null)
  }
  // The status is enough to act on; the body is not echoed, in case it quotes the request.
  if (!res.ok)
    throw new CloudflareError(`Cloudflare cache purge answered ${res.status}`, res.status)
  const answer = (await res.json().catch(() => null)) as { success?: unknown } | null
  if (answer?.success !== true) {
    throw new CloudflareError('Cloudflare cache purge did not succeed', res.status)
  }
}

/**
 * Purges every cached page of these hostnames, 30 to a call. Hostnames are lower-cased and
 * de-duplicated; an empty list makes no call.
 */
export async function purgeCloudflareHosts(
  config: CloudflarePurgeConfig,
  hosts: readonly string[],
  opts: { fetch?: Fetch | undefined } = {},
): Promise<void> {
  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init))
  const unique = [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))]
  for (let i = 0; i < unique.length; i += PURGE_HOSTS_PER_CALL) {
    await purge(config, { hosts: unique.slice(i, i + PURGE_HOSTS_PER_CALL) }, doFetch)
  }
}

/** Purges the whole zone: only after the listener lost writes it can no longer name. */
export async function purgeCloudflareZone(
  config: CloudflarePurgeConfig,
  opts: { fetch?: Fetch | undefined } = {},
): Promise<void> {
  await purge(config, { purge_everything: true }, opts.fetch ?? ((i, init) => fetch(i, init)))
}
