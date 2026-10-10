import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'
import {
  BREAKDOWN_TYPES,
  toRows,
  toTrend,
  toUmamiStats,
  UMAMI_BREAKDOWNS,
  type UmamiBreakdown,
  type UmamiReport,
  type UmamiRow,
  umamiKpis,
} from './report'
import { umamiApiBase } from './settings'

/**
 * A small client for Umami's REST API (https://docs.umami.is/docs/api), server side only: it
 * carries the store's API key. Self-hosted Umami takes `Authorization: Bearer <key>` on
 * `<url>/api`; Umami Cloud the same header on `https://api.umami.is/v1`.
 *
 * The address is the merchant's, so every call goes through `safeFetch` (public https hosts
 * only, headers never follow a redirect elsewhere) unless the platform listed its origin in
 * `UMAMI_TRUSTED_ORIGINS` (our own Umami on the private network).
 */

export type UmamiErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'bad-request'
  | 'unreachable'
  | 'bad-response'

const MESSAGES: Record<UmamiErrorCode, string> = {
  unauthorized: 'Umami did not accept the API key. Create a new one in Umami and paste it again.',
  'not-found': 'Umami has no website with that id. Check the website id, or create one here.',
  'bad-request': 'Umami could not answer that question. It may be an older version of Umami.',
  unreachable:
    'Could not reach Umami at that address. Check the address and that Umami is running.',
  'bad-response': 'Umami sent an answer we could not read. Check the address points at Umami.',
}

export class UmamiError extends Error {
  constructor(readonly code: UmamiErrorCode) {
    super(MESSAGES[code])
    this.name = 'UmamiError'
  }
}

export type UmamiClientOptions = {
  /** The normalised Umami address (`normaliseUmamiUrl`). */
  url: string
  apiKey: string
  /** Origins reached with a plain fetch: private network or http allowed. */
  trustedOrigins?: readonly string[] | undefined
  /** Injected in tests. */
  fetch?: typeof fetch | undefined
  /** Injected in tests. */
  lookup?: LookupAll | undefined
  timeoutMs?: number | undefined
}

/** A range in Umami's terms: epoch milliseconds, plus the ISO days the page plots. */
export type UmamiRange = { startAt: number; endAt: number; days: readonly string[] }

/** The most an answer may weigh; a ranked list of ten rows is a few kilobytes. */
const MAX_BYTES = 2_000_000

/** `UMAMI_TRUSTED_ORIGINS` (comma-separated) as a clean list of origins. */
export function parseTrustedOrigins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => {
      try {
        return new URL(s.trim()).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

export function umamiClient(opts: UmamiClientOptions) {
  const base = umamiApiBase(opts.url)
  const trusted = (opts.trustedOrigins ?? []).includes(new URL(base).origin)
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 15_000

  async function send(
    path: string,
    init: { method?: 'GET' | 'POST'; query?: Record<string, string | number>; body?: unknown } = {},
  ): Promise<unknown> {
    const url = new URL(`${base}${path}`)
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, String(v))
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    const body = init.body === undefined ? undefined : JSON.stringify(init.body)
    let res: Response
    try {
      res = trusted
        ? await doFetch(url.href, {
            method: init.method ?? 'GET',
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            ...(body === undefined ? {} : { body }),
          })
        : await safeFetch(url.href, {
            method: init.method ?? 'GET',
            headers,
            body,
            fetch: doFetch,
            ...(opts.lookup ? { lookup: opts.lookup } : {}),
            timeoutMs,
          })
    } catch {
      throw new UmamiError('unreachable')
    }
    if (res.status === 401 || res.status === 403) throw new UmamiError('unauthorized')
    if (res.status === 404) throw new UmamiError('not-found')
    if (res.status === 400) throw new UmamiError('bad-request')
    if (!res.ok) throw new UmamiError(res.status >= 500 ? 'unreachable' : 'bad-response')
    const bytes = await readCapped(res, MAX_BYTES)
    if (!bytes) throw new UmamiError('bad-response')
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      throw new UmamiError('bad-response')
    }
  }

  const span = (range: UmamiRange) => ({ startAt: range.startAt, endAt: range.endAt })
  const site = (websiteId: string) => `/websites/${encodeURIComponent(websiteId)}`

  /** One ranked list, trying each name Umami has used for it; empty when none is known. */
  async function breakdown(
    websiteId: string,
    key: UmamiBreakdown,
    range: UmamiRange,
    limit: number,
  ): Promise<UmamiRow[]> {
    for (const type of BREAKDOWN_TYPES[key]) {
      try {
        return toRows(
          await send(`${site(websiteId)}/metrics`, { query: { ...span(range), type, limit } }),
          limit,
        )
      } catch (err) {
        if (!(err instanceof UmamiError) || err.code !== 'bad-request') throw err
      }
    }
    return []
  }

  return {
    /** The website, which also proves the key can read it. */
    async website(websiteId: string): Promise<{ id: string; name: string; domain: string }> {
      const raw = await send(site(websiteId))
      const w = (raw ?? {}) as Record<string, unknown>
      if (typeof w.id !== 'string') throw new UmamiError('bad-response')
      return { id: w.id, name: String(w.name ?? ''), domain: String(w.domain ?? '') }
    },

    /** A new website in the key owner's Umami account. */
    async createWebsite(input: { name: string; domain: string }): Promise<{ id: string }> {
      const raw = (await send('/websites', { method: 'POST', body: input })) as Record<
        string,
        unknown
      > | null
      if (!raw || typeof raw.id !== 'string') throw new UmamiError('bad-response')
      return { id: raw.id }
    },

    /** Figures, daily trend and the ranked lists for one range, fetched in parallel. */
    async report(
      websiteId: string,
      range: UmamiRange,
      timezone: string,
      limit = 10,
    ): Promise<UmamiReport> {
      const [stats, trend, ...lists] = await Promise.all([
        send(`${site(websiteId)}/stats`, { query: span(range) }),
        send(`${site(websiteId)}/pageviews`, { query: { ...span(range), unit: 'day', timezone } }),
        ...UMAMI_BREAKDOWNS.map((key) => breakdown(websiteId, key, range, limit)),
      ])
      const { visitors, pageviews } = toTrend(trend, range.days)
      const breakdowns = Object.fromEntries(
        UMAMI_BREAKDOWNS.map((key, i) => [key, (lists[i] as UmamiRow[] | undefined) ?? []]),
      ) as Record<UmamiBreakdown, UmamiRow[]>
      return { kpis: umamiKpis(toUmamiStats(stats)), visitors, pageviews, breakdowns }
    },
  }
}

export type UmamiClient = ReturnType<typeof umamiClient>
