/**
 * What a PIN code is (its post offices, district and state), from India Post's All India Pincode
 * Directory. Three sources, best first:
 *
 *  1. data.gov.in's live API for the directory, when the merchant pasted their own data.gov.in
 *     API key (free, from https://www.data.gov.in after signing up). It names the post offices.
 *       GET https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd
 *           ?api-key={key}&format=json&limit=50&filters[pincode]={pin}
 *       → { status: "ok", total, records: [{ officename, pincode, officetype, delivery,
 *           district, statename, … }] }   (403 { error: "Key not authorised" } for a bad key)
 *     Verified against the live API on 2026-10-20 (110001: 23 offices, NEW DELHI, DELHI).
 *  2. The bundled directory file (`@commerce/shipping/pincode-directory`), when it is installed:
 *     district and state, no office names.
 *  3. Nothing: the PIN code's digits only (`source: 'prefix'`), which still validate it and
 *     still give a zone (see zones.ts).
 *
 * Both datasets are the Department of Posts' directory published on data.gov.in under the
 * Government Open Data Licence - India (GODL-India), which allows use with attribution
 * (docs/open-source-radar.md, THIRD_PARTY_NOTICES.md).
 *
 * Answers are cached per process for a day: a PIN code's post offices change a few times a year,
 * and checkout asks about the same PIN codes over and over.
 */
import { CourierError, courierFetch, courierJson, type PincodeDirectory } from '@commerce/shipping'
import type { PinPlace } from './zones'

export const PINCODE_API_URL =
  'https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd'

const PROVIDER = 'India Post'
const DAY_MS = 24 * 60 * 60_000
const CACHE_MAX = 5_000
const OFFICES_SHOWN = 5

type ApiRecord = {
  officename?: string
  officetype?: string
  delivery?: string
  district?: string
  statename?: string
}

type ApiAnswer = { status?: string; total?: number; records?: ApiRecord[]; error?: string }

export type PinDirectoryDeps = {
  /** data.gov.in API key; absent skips the live lookup. */
  apiKey?: string | undefined
  fetchImpl?: typeof fetch | undefined
  /** The bundled directory, or null when it is not installed. */
  loadDirectory?: (() => Promise<PincodeDirectory | null>) | undefined
  now?: (() => number) | undefined
}

/** "NEW DELHI" → "New Delhi". */
function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s(-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** Delivery offices first, then head, sub and branch offices, each group by name. */
function officeRank(r: ApiRecord): number {
  const delivers = (r.delivery ?? '').toLowerCase() === 'delivery' ? 0 : 10
  const type = (r.officetype ?? '').toUpperCase()
  return delivers + (type === 'HO' ? 0 : type === 'PO' || type === 'SO' ? 1 : 2)
}

/** Most offices of a PIN code sit in one district; keep that one (ties: alphabetical). */
function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return best?.[0] ?? null
}

export function placeFromApi(pincode: string, records: ApiRecord[]): PinPlace | null {
  if (records.length === 0) return null
  const sorted = [...records].sort(
    (a, b) =>
      officeRank(a) - officeRank(b) || (a.officename ?? '').localeCompare(b.officename ?? ''),
  )
  const district = mostCommon(records.map((r) => (r.district ?? '').trim().toUpperCase()))
  const state = mostCommon(records.map((r) => (r.statename ?? '').trim().toUpperCase()))
  return {
    pincode,
    offices: [...new Set(sorted.map((r) => (r.officename ?? '').trim()).filter(Boolean))].slice(
      0,
      OFFICES_SHOWN,
    ),
    district: district ? titleCase(district) : null,
    state: state ? state.replace(/\s*&\s*/g, ' AND ') : null,
    source: 'data.gov.in',
  }
}

/**
 * Looks PIN codes up. `lookup` answers null for a PIN code a directory does not know (a real
 * "no such PIN code"), and a `prefix` place when no directory could be asked.
 */
export class PinDirectory {
  private readonly cache = new Map<string, { at: number; place: PinPlace | null }>()
  private readonly deps: PinDirectoryDeps

  constructor(deps: PinDirectoryDeps) {
    this.deps = deps
  }

  /** One call to data.gov.in. Throws CourierError on transport, auth or a surprise body. */
  async fromApi(pincode: string): Promise<PinPlace | null> {
    const key = this.deps.apiKey
    if (!key) throw new CourierError('not_configured', PROVIDER, 'No data.gov.in API key.')
    const url = new URL(PINCODE_API_URL)
    url.searchParams.set('api-key', key)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '50')
    url.searchParams.set('filters[pincode]', pincode)
    const res = await courierFetch('data.gov.in', url.toString(), {
      fetchImpl: this.deps.fetchImpl,
      headers: { accept: 'application/json' },
    })
    const body = await courierJson<ApiAnswer>('data.gov.in', res)
    if (body.status !== 'ok' || !Array.isArray(body.records)) {
      throw new CourierError('bad_response', 'data.gov.in', 'data.gov.in answered without records.')
    }
    return placeFromApi(pincode, body.records)
  }

  async lookup(pincode: string): Promise<PinPlace | null> {
    const now = this.deps.now?.() ?? Date.now()
    const hit = this.cache.get(pincode)
    if (hit && now - hit.at < DAY_MS) return hit.place
    const place = await this.resolve(pincode)
    if (place?.source !== 'prefix') {
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string)
      this.cache.set(pincode, { at: now, place })
    }
    return place
  }

  private async resolve(pincode: string): Promise<PinPlace | null> {
    if (this.deps.apiKey) {
      try {
        return await this.fromApi(pincode)
      } catch {
        // data.gov.in down or the key revoked: the bundled file or the digits still answer.
      }
    }
    const directory = await this.deps.loadDirectory?.().catch(() => null)
    if (directory) {
      const found = directory.lookup(pincode)
      return found
        ? {
            pincode,
            offices: [],
            district: found.district,
            state: found.stateCode,
            source: 'directory',
          }
        : null
    }
    return { pincode, offices: [], district: null, state: null, source: 'prefix' }
  }
}
