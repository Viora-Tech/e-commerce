import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  decryptSecret,
  loadSearchConsoleEntry,
  replaceSearchConsoleRows,
  SEARCH_PERIOD_DAYS,
  type SearchDimension,
  type SearchPeriod,
  type SearchRow,
  saveSearchConsoleEntry,
  searchPath,
} from '@commerce/core'
import { dayKey } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import {
  type GoogleOAuthApp,
  type GoogleSearchQuery,
  type GoogleSearchRow,
  refreshGoogleAccessToken,
  type SearchConsoleClient,
  SearchConsoleError,
  searchConsoleClient,
} from './google'
import {
  parseSearchConsoleSettings,
  type SearchConsoleSettings,
  type SearchDateRange,
} from './settings'

/**
 * Server side of the Google Search Console app: the signed OAuth `state` and its PKCE
 * verifier, the date ranges, pulling Search Analytics from Google and the sync that stores it.
 * The sync runs from the worker's daily job and from "Refresh now"; it never holds a database
 * transaction open while it waits on Google.
 */

/** A `state` lives this long: enough to sign in to Google, too short to be replayed later. */
const STATE_TTL_MS = 30 * 60_000

const mac = (payload: string, secret: string) =>
  createHmac('sha256', `search-console-oauth:${secret}`).update(payload).digest('base64url')

/**
 * The OAuth `state`: which store started the connection and a random nonce, signed so a forged
 * or swapped callback (CSRF) is refused, and dated so it expires.
 */
export function signSearchConsoleState(
  storeId: string,
  secret: string,
  now: Date = new Date(),
): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ storeId, n: nonce, exp: now.getTime() + STATE_TTL_MS }),
  ).toString('base64url')
  return { state: `${payload}.${mac(payload, secret)}`, nonce }
}

/** The store and nonce inside a `state` we signed, or null when it is forged or expired. */
export function verifySearchConsoleState(
  raw: string,
  secret: string,
  now: Date = new Date(),
): { storeId: string; nonce: string } | null {
  const [payload, given] = raw.split('.')
  if (!payload || !given) return null
  const expected = Buffer.from(mac(payload, secret))
  const actual = Buffer.from(given)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      storeId?: unknown
      n?: unknown
      exp?: unknown
    }
    if (typeof s.storeId !== 'string' || typeof s.n !== 'string') return null
    if (typeof s.exp !== 'number' || s.exp < now.getTime()) return null
    return { storeId: s.storeId, nonce: s.n }
  } catch {
    return null
  }
}

/**
 * The PKCE verifier for a nonce: derived with the server secret, so nothing is stored between
 * "Connect" and the callback, and someone who sees the redirect (code, state, nonce) still
 * cannot make it. 43 base64url characters, as PKCE asks.
 */
export const pkceVerifier = (nonce: string, secret: string): string =>
  createHmac('sha256', `search-console-pkce:${secret}`).update(nonce).digest('base64url')

/** `YYYY-MM-DD` moved by whole days. */
function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Google's final numbers trail by about two days; three keeps the last day complete. */
const DATA_LAG_DAYS = 3

/**
 * The 28 days Google has final numbers for and the 28 before. Search Console counts days in
 * Pacific time, so "today" is Pacific too.
 */
export function searchRanges(now: Date = new Date()): {
  current: SearchDateRange
  previous: SearchDateRange
} {
  const end = addDays(dayKey(now, 'America/Los_Angeles'), -DATA_LAG_DAYS)
  const start = addDays(end, -(SEARCH_PERIOD_DAYS - 1))
  return {
    current: { start, end },
    previous: {
      start: addDays(start, -SEARCH_PERIOD_DAYS),
      end: addDays(start, -1),
    },
  }
}

/** What one stored dimension asks Google for, per period. */
const PULLS: {
  dimension: SearchDimension
  dimensions: GoogleSearchQuery['dimensions']
  rowLimit?: number
  periods: SearchPeriod[]
}[] = [
  { dimension: 'total', dimensions: [], periods: ['current', 'previous'] },
  { dimension: 'page', dimensions: ['page'], rowLimit: 1000, periods: ['current', 'previous'] },
  { dimension: 'query', dimensions: ['query'], rowLimit: 1000, periods: ['current', 'previous'] },
  // Searches per page: only this period, for each page's top searches and the product card.
  { dimension: 'page_query', dimensions: ['page', 'query'], rowLimit: 5000, periods: ['current'] },
  { dimension: 'device', dimensions: ['device'], rowLimit: 10, periods: ['current', 'previous'] },
  {
    dimension: 'country',
    dimensions: ['country'],
    rowLimit: 250,
    periods: ['current', 'previous'],
  },
]

/** One Google row as stored: keys placed by the dimensions asked for. */
export function toSearchRow(
  period: SearchPeriod,
  dimension: SearchDimension,
  dimensions: GoogleSearchQuery['dimensions'],
  row: GoogleSearchRow,
): SearchRow {
  const key = (name: GoogleSearchQuery['dimensions'][number]) => {
    const i = dimensions.indexOf(name)
    return i >= 0 ? (row.keys?.[i] ?? null) : null
  }
  const page = key('page')
  return {
    period,
    dimension,
    page,
    path: page ? searchPath(page) : null,
    query: key('query'),
    segment: key('device') ?? key('country'),
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    position: row.position ?? 0,
  }
}

/** Every stored dimension for both periods, asked of Google at once. */
export async function fetchSearchRows(
  client: SearchConsoleClient,
  property: string,
  ranges: { current: SearchDateRange; previous: SearchDateRange },
): Promise<SearchRow[]> {
  const asks = PULLS.flatMap((pull) => pull.periods.map((period) => ({ pull, period })))
  const answers = await Promise.all(
    asks.map(async ({ pull, period }) => {
      const range = ranges[period]
      const rows = await client.query(property, {
        startDate: range.start,
        endDate: range.end,
        dimensions: pull.dimensions,
        ...(pull.rowLimit ? { rowLimit: pull.rowLimit } : {}),
      })
      return rows.map((r) => toSearchRow(period, pull.dimension, pull.dimensions, r))
    }),
  )
  return answers.flat()
}

/** What a sync needs: the store, a way into its transaction, and the platform's Google client. */
export type SearchConsoleSyncDeps = {
  storeId: string
  inStore: <T>(fn: (tx: StoreTx) => Promise<T>) => Promise<T>
  secret: string
  app: GoogleOAuthApp | null
  fetchImpl?: typeof fetch | undefined
  now?: Date | undefined
}

export type SearchConsoleSyncResult =
  | { state: 'skipped' }
  | { state: 'synced'; rows: number }
  | { state: 'failed'; message: string; reconnect: boolean }

/** The saved settings, read fresh inside a transaction. */
async function settingsIn(tx: StoreTx, storeId: string): Promise<SearchConsoleSettings> {
  return parseSearchConsoleSettings((await loadSearchConsoleEntry(tx, storeId)).settings)
}

/** The same connection and property as when the sync started: nobody disconnected meanwhile. */
const sameConnection = (a: SearchConsoleSettings, b: SearchConsoleSettings) =>
  a.refreshToken === b.refreshToken && a.property === b.property

/**
 * Pulls the store's last 28 days (and the 28 before) from Google and replaces the stored rows.
 * Reads the settings in one transaction, asks Google outside any, then writes in another, and
 * only if the connection and property did not change in between. The try is dated
 * (`attemptedAt`) with its outcome, so the worker's daily schedule moves on either way. A failure is saved as the
 * app's `lastError` (and `reconnect` when Google dropped the access) and returned, not thrown.
 */
export async function syncSearchConsole(
  deps: SearchConsoleSyncDeps,
): Promise<SearchConsoleSyncResult> {
  const now = deps.now ?? new Date()
  const { storeId } = deps
  const started = await deps.inStore(async (tx) => {
    const entry = await loadSearchConsoleEntry(tx, storeId)
    const settings = parseSearchConsoleSettings(entry.settings)
    if (!entry.installed || !settings.refreshToken || !settings.property) return null
    return settings
  })
  if (!started) return { state: 'skipped' }
  // One write per sync, whatever happens: each `store` row write also drops the store's
  // storefront cache (migration 0115), so the try is dated together with the outcome.
  const attemptedAt = now.toISOString()

  try {
    const app = deps.app
    if (!app) {
      throw new SearchConsoleError(
        'GOOGLE_API',
        'Google Search Console is not set up on this platform any more.',
      )
    }
    let refreshToken: string
    try {
      refreshToken = decryptSecret(started.refreshToken, deps.secret)
    } catch {
      throw new SearchConsoleError(
        'GOOGLE_AUTH',
        'The saved Google access can no longer be read. Connect Google Search Console again.',
      )
    }
    const accessToken = await refreshGoogleAccessToken(app, refreshToken, deps.fetchImpl)
    const ranges = searchRanges(now)
    const rows = await fetchSearchRows(
      searchConsoleClient(accessToken, deps.fetchImpl),
      started.property,
      ranges,
    )
    const written = await deps.inStore(async (tx) => {
      const fresh = await settingsIn(tx, storeId)
      if (!sameConnection(fresh, started)) return false
      await replaceSearchConsoleRows(tx, storeId, rows)
      await saveSearchConsoleEntry(tx, storeId, {
        ...fresh,
        attemptedAt,
        syncedAt: attemptedAt,
        lastError: '',
        reconnect: false,
        ranges,
      })
      return true
    })
    return written ? { state: 'synced', rows: rows.length } : { state: 'skipped' }
  } catch (err) {
    const known = err instanceof SearchConsoleError
    const message = known ? err.message : 'Could not update from Google. It tries again tomorrow.'
    const reconnect = known && err.code === 'GOOGLE_AUTH'
    await deps.inStore(async (tx) => {
      const fresh = await settingsIn(tx, storeId)
      if (!sameConnection(fresh, started)) return
      await saveSearchConsoleEntry(tx, storeId, {
        ...fresh,
        attemptedAt,
        lastError: message,
        reconnect,
      })
    })
    // Anything but Google's answer is a bug: let the job (or the request) fail loudly too.
    if (!known) throw err
    return { state: 'failed', message, reconnect }
  }
}
