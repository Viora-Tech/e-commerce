import { CommerceError } from '@commerce/core'
import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'
import { featuresUrl, growthbookApiBase } from './settings'

/**
 * A small client for GrowthBook, server side only. Two calls:
 *
 * - the SDK connection's features (`GET <apiHost>/api/features/<clientKey>`), public, what
 *   the storefront assigns shoppers with;
 * - the REST API's experiment list (`GET /api/v1/experiments`, `Authorization: Bearer <secret
 *   key>`), for the app page.
 *
 * The address is the merchant's, so every call goes through `safeFetch` (public https hosts
 * only, headers never follow a redirect elsewhere) unless the platform listed its origin in
 * `GROWTHBOOK_TRUSTED_ORIGINS` (our own GrowthBook on the private network).
 */

export type GrowthbookErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'bad-request'
  | 'unreachable'
  | 'bad-response'

const MESSAGES: Record<GrowthbookErrorCode, string> = {
  unauthorized:
    'GrowthBook did not accept the secret API key. Create a read-only key in GrowthBook and paste it again.',
  'not-found':
    'GrowthBook has no SDK connection with that client key. Copy it again from SDK Connections.',
  'bad-request': 'GrowthBook could not answer that question. It may be an older version.',
  unreachable:
    'Could not reach GrowthBook at that address. Check the address and that GrowthBook is running.',
  'bad-response':
    'GrowthBook sent an answer we could not read. Check the address points at GrowthBook’s API.',
}

export class GrowthbookError extends CommerceError {
  override readonly code: GrowthbookErrorCode

  constructor(code: GrowthbookErrorCode) {
    super(code, MESSAGES[code])
    this.code = code
  }
}

export type GrowthbookClientOptions = {
  /** The normalised API host (`normaliseGrowthbookUrl`). */
  apiHost: string
  /** Origins reached with a plain fetch: private network or http allowed. */
  trustedOrigins?: readonly string[] | undefined
  /** Injected in tests. */
  fetch?: typeof fetch | undefined
  /** Injected in tests. */
  lookup?: LookupAll | undefined
  timeoutMs?: number | undefined
}

/** The most an answer may weigh: a features payload of a few hundred flags. */
const MAX_BYTES = 4_000_000

/** `GROWTHBOOK_TRUSTED_ORIGINS` (comma-separated) as a clean list of origins. */
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

/** One experiment as the app page lists it. */
export type GrowthbookExperiment = {
  id: string
  /** The tracking key: what a section's "experiment key" setting names. */
  trackingKey: string
  name: string
  status: 'draft' | 'running' | 'stopped'
  archived: boolean
  /** Variation ids (0 = control) with their names. */
  variations: { id: number; key: string; name: string }[]
  /** ISO start of the current phase, when it has started. */
  startedAt: string | null
  /** GrowthBook's verdict once stopped (`won`, `lost`, `dnf`, `inconclusive`), else null. */
  result: string | null
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const STATUSES = new Set(['draft', 'running', 'stopped'])

/** One entry of `/api/v1/experiments`, or null when it is not an experiment. */
export function toExperiment(raw: unknown): GrowthbookExperiment | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  const status = STATUSES.has(str(raw.status))
    ? (raw.status as GrowthbookExperiment['status'])
    : 'draft'
  const variations = (Array.isArray(raw.variations) ? raw.variations : [])
    .filter(isRecord)
    .map((v, index) => ({ id: index, key: str(v.key) || String(index), name: str(v.name) }))
  const phases = (Array.isArray(raw.phases) ? raw.phases : []).filter(isRecord)
  const phase = phases.at(-1)
  const summary = isRecord(raw.resultSummary) ? raw.resultSummary : null
  return {
    id: raw.id,
    trackingKey: str(raw.trackingKey) || raw.id,
    name: str(raw.name) || str(raw.trackingKey) || raw.id,
    status,
    archived: raw.archived === true,
    variations,
    startedAt: str(phase?.dateStarted) || null,
    result: summary ? str(summary.status) || null : null,
  }
}

/** Running first, then drafts, then stopped; newest start first within each. */
const ORDER: Record<GrowthbookExperiment['status'], number> = { running: 0, draft: 1, stopped: 2 }

export function sortExperiments(list: GrowthbookExperiment[]): GrowthbookExperiment[] {
  return [...list].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] || (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
  )
}

export function growthbookClient(opts: GrowthbookClientOptions) {
  const trustedOrigins = opts.trustedOrigins ?? []
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  async function getJson(href: string, headers: Record<string, string>): Promise<unknown> {
    const trusted = trustedOrigins.includes(new URL(href).origin)
    let res: Response
    try {
      res = trusted
        ? await doFetch(href, {
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
          })
        : await safeFetch(href, {
            headers,
            fetch: doFetch,
            ...(opts.lookup ? { lookup: opts.lookup } : {}),
            timeoutMs,
          })
    } catch {
      throw new GrowthbookError('unreachable')
    }
    if (res.status === 401 || res.status === 403) throw new GrowthbookError('unauthorized')
    if (res.status === 404) throw new GrowthbookError('not-found')
    if (res.status === 400) throw new GrowthbookError('bad-request')
    if (!res.ok) throw new GrowthbookError(res.status >= 500 ? 'unreachable' : 'bad-response')
    const bytes = await readCapped(res, MAX_BYTES)
    if (!bytes) throw new GrowthbookError('bad-response')
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      throw new GrowthbookError('bad-response')
    }
  }

  return {
    /** The SDK connection's payload, as the SDK takes it (`features`, maybe encrypted). */
    async features(clientKey: string): Promise<Record<string, unknown>> {
      const raw = await getJson(featuresUrl(opts.apiHost, clientKey), {
        accept: 'application/json',
      })
      if (
        !isRecord(raw) ||
        !(isRecord(raw.features) || typeof raw.encryptedFeatures === 'string')
      ) {
        throw new GrowthbookError('bad-response')
      }
      return raw
    },

    /** The experiments the key can see, newest first, at most `limit` (one page). */
    async experiments(secretKey: string, limit = 100): Promise<GrowthbookExperiment[]> {
      const url = new URL(`${growthbookApiBase(opts.apiHost)}/experiments`)
      url.searchParams.set('limit', String(Math.min(100, Math.max(1, limit))))
      const raw = await getJson(url.href, {
        accept: 'application/json',
        authorization: `Bearer ${secretKey}`,
      })
      if (!isRecord(raw) || !Array.isArray(raw.experiments))
        throw new GrowthbookError('bad-response')
      return sortExperiments(
        raw.experiments.map(toExperiment).filter((e): e is GrowthbookExperiment => e !== null),
      )
    },
  }
}

export type GrowthbookClient = ReturnType<typeof growthbookClient>
